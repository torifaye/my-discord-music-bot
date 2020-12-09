import { Client, Message } from 'discord.js';
import { inject, injectable } from 'inversify';
import ytdl from 'ytdl-core';
import Axios from 'axios';
import { YoutubeOembedResponse } from '../models/youtube';
import { TYPES } from '../types';
import { QueueService } from './queue.service';
import { Server } from '../models/guild';
import { SpotifyService } from './spotify.sesrvice';
import { YoutubeService } from './youtube.service';

@injectable()
export class MessageResponder {
    private readonly urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
    private readonly youtubeRegex = /(https:\/\/www.youtube.com\/watch\?v=.*|https:\/\/youtu.be\/.*)/;
    private readonly spotifyRegex = /https:\/\/open.spotify.com\/(track|album|playlist)\/(.+)\?si=.+/;
    private readonly volumeRegex = /(?:[-+]?([0-9]*\.[0-9]+|[0-9]+)|show)/;

    constructor(
        @inject(TYPES.QueueService) private queueService: QueueService,
        @inject(TYPES.SpotifyService) private spotifyService: SpotifyService,
        @inject(TYPES.YoutubeService) private youtubeService: YoutubeService) {
    }

    public async handle(message: Message, server: Server): Promise<Message | Message[]> {
        const [command, ...args] = this.tokenize(message.content);
        switch (command) {
            case 'play':
                return this.handlePlay(args, message, server);
            case 'queue':
                return this.handleQueueView(message);
            case 'vol':
            case 'volume':
                return this.handleVolume(message, server);
            case 'clear':
                return this.handleClear(message);
            case 'skip':
                server.dispatcher.end();
                break;
            case 'leave':
                return this.handleLeave(message, server);
            default:
                return;
        }
        return;
    }

    private async handlePlay(args: string[], message: Message, server: Server): Promise<Message> {
        if (message.member.voice.channel) {
            server.connection = await message.member.voice.channel.join();
            server.connection.voice.setSelfDeaf(true);
            if (args.length === 0) {
                return message.channel.send('Invalid input provided, please try again');
            } else {
                if (args[0].match(this.urlRegex)) {
                    if (args[0].match(this.youtubeRegex)) {
                        return this.handleYoutube(message, server);
                    } else if (args[0].match(this.spotifyRegex)) {
                        return this.handleSpotify(args[0], message, server);
                    }
                } else {
                    return this.handlePlainInput(args, message, server);
                }
            }
        } else {
            return message.reply('You must be in a voice channel to use notorious-music-bot');
        }
    }

    private async handleYoutube(message: Message, server: Server): Promise<Message> {
        const [_input, url, ...rest] = this.youtubeRegex.exec(message.content);
        const response = (await Axios.get<YoutubeOembedResponse>(`https://www.youtube.com/oembed`, { params: { url, format: "json" } })).data;
        response.video_url = url;
        await this.queueService.addToQueue(message.guild.name, response);
        if (!server.isPlayingSong) {
            this.playSong(message, server);
        } else {
            return await message.channel.send(`Added **${response.title}** to queue`);
        }
    }

    private async handleSpotify(url: string, message: Message, server: Server): Promise<Message> {
        const [_input, type, uri] = this.spotifyRegex.exec(url);
        switch (type) {
            case 'track':
                const track = await this.spotifyService.getTrack(uri);
                const song = await this.prepareSong(`${track.artists[0].name} - ${track.name}`, message);
                if (!server.isPlayingSong) {
                    this.playSong(message, server);
                } else {
                    return await message.channel.send(`Added **${song.title}** to queue`);
                }
                break;
            case 'album':
                const album = await this.spotifyService.getAlbum(uri);
                const albumSearchQueries = album.map(song => `${song.artists[0].name} - ${song.name}`);
                albumSearchQueries.forEach(async (query) => {
                    this.prepareSong(query, message);
                });
                if (!server.isPlayingSong) {
                    this.playSong(message, server);
                } else {
                    return message.channel.send(`Enqueued **${album.length}** songs.`);
                }
            case 'playlist':
                const playlist = await this.spotifyService.getPlaylist(uri);
                const playlistSearchQueries = playlist.map(song => `${song.artists[0].name} - ${song.name}`);
                playlistSearchQueries.forEach(async (query) => {
                    this.prepareSong(query, message);
                });
                if (!server.isPlayingSong) {
                    this.playSong(message, server);
                } else {
                    return message.channel.send(`Enqueued **${playlist.length}** songs.`);
                }
        }
    }

    private async handlePlainInput(args: string[], message: Message, server: Server): Promise<Message> {
        const response = await this.prepareSong(args.join(' '), message);
        if (!server.isPlayingSong) {
            this.playSong(message, server);
        } else {
            return await message.channel.send(`Added **${response.title}** to queue`);
        }
    }

    private async prepareSong(query: string, message: Message): Promise<YoutubeOembedResponse> {
        const url = await this.youtubeService.searchForSong(query);
        console.log({ purpose: 'query_data', query_string: query, song_url: url });
        const metadata = (await Axios.get<YoutubeOembedResponse>(`https://www.youtube.com/oembed`, { params: { url, format: "json" } })).data;
        metadata.video_url = url;
        await this.queueService.addToQueue(message.guild.name, metadata);
        return metadata;
    }

    private async playSong(message: Message, server: Server) {
        const queue = await this.queueService.getQueue(message.guild.name);
        server.dispatcher = server.connection.play(ytdl(queue[0].video_url, { filter: 'audioonly' }));
        message.reply(`Now playing **${queue[0].title}**`);
        server.isPlayingSong = true;
        server.dispatcher.on('finish', async () => {
            await this.queueService.shiftQueue(message.guild.name);
            const updatedQueue = await this.queueService.getQueue(message.guild.name);
            if (updatedQueue[0]) {
                this.playSong(message, server);
            } else {
                server.isPlayingSong = false;
            }
        });
    }

    private async handleVolume(message: Message, server: Server): Promise<Message> {
        if (message.member.voice.channel) {
            const matches = this.volumeRegex.exec(message.content);
            if (server.dispatcher) {
                if (isNaN(parseFloat(matches[1]))) {
                    message.channel.send(`The current volume is **${server.volume}**`);
                } else {
                    const provided = parseInt(matches[1]);
                    if (provided > 200 || provided < 0) {
                        return message.reply('The volume must be a whole number between 0 and 200.');
                    } else {
                        server.dispatcher.setVolume(this.scaleVolume(provided));
                        return message.channel.send(`Changing volume from **${server.volume}** to **${provided}**`);
                    }
                }
            } else {
                return message.reply('There currently isn\'t anything playing');
            }
        } else {
            return message.reply('You must be in a voice channel to use notorious-music-bot');
        }
    }

    async handleQueueView(message: Message): Promise<Message> {
        if (message.member.voice.channel) {
            const queue = await this.queueService.getQueue(message.guild.name);
            if (queue.length > 0) {
                const songs = queue.map((info, index) => `**${index + 1})** ${info.title}`).join('\n');
                return message.channel.send(songs);
            } else {
                return message.channel.send('No songs in queue!');
            }
        } else {
            return message.reply('You must be in a voice channel to use notorious-music-bot');
        }
    }

    async handleClear(message: Message): Promise<Message> {
        if (message.member.voice.channel) {
            await this.queueService.clearQueue(message.guild.name);
            return message.channel.send('Cleared queue');
        } else {
            return message.reply('You must be in a voice channel to use notorious-music-bot');
        }
    }

    async handleLeave(message: Message, server: Server): Promise<Message> {
        if (message.member.voice.channel) {
            server.dispatcher?.destroy();
            server.connection?.disconnect();
            server.isPlayingSong = false;
            server.volume = 100;
            this.queueService.clearQueue(message.guild.name);
            return message.reply(`Leaving ${message.member.voice.channel.name}...`);
        } else {
            return message.reply('You must be in a voice channel to use notorious-music-bot');
        }
    }

    private scaleVolume(provided: number): number {
        return (2.0 - 0.0) * (provided - 0.0) / (200 - 0) + 0; // formula for scaling from one range to another
    }

    private tokenize(input: string): Array<string> {
        return input.split(/[~ \t]/).slice(1);
    }
}