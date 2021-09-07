import { Client, Emoji, Message, MessageEmbed, MessageReaction } from "discord.js";
import { inject, injectable } from "inversify";
import ytdl from "ytdl-core";
import Axios from "axios";
import { YoutubeOembedResponse } from "../models/youtube";
import { TYPES } from "../types";
import { QueueService } from "./queue.service";
import { Server } from "../models/guild";
import { SpotifyService, TrackResponse } from "./spotify.sesrvice";
import { YoutubeService } from "./youtube.service";

@injectable()
export class MessageResponder {
  private readonly urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
  private readonly youtubeRegex = /(https:\/\/www.youtube.com\/(watch\?v=.*|playlist\?list=.*)|https:\/\/youtu.be\/.*)/;
  private readonly spotifyRegex = /https:\/\/open.spotify.com\/(track|album|playlist)\/(.+)\?si=.+/;
  private readonly volumeRegex = /(?:[-+]?([0-9]*\.[0-9]+|[0-9]+)|show)/;

  constructor(
    @inject(TYPES.QueueService) private queueService: QueueService,
    @inject(TYPES.SpotifyService) private spotifyService: SpotifyService,
    @inject(TYPES.YoutubeService) private youtubeService: YoutubeService
  ) {}

  public async handle(message: Message, server: Server): Promise<Message | Message[] | MessageReaction> {
    const [command, ...args] = this.tokenize(message.content);
    switch (command) {
      case "play":
        return this.handlePlay(args, message, server);
      case "queue":
        return this.handleQueueView(message, server);
      case "vol":
      case "volume":
        return this.handleVolume(message, server);
      case "loop":
        return this.handleLoop(message, server);
      case "clear":
        return this.handleClear(message, server);
      case "pause":
        return this.handlePause(message, server);
      case "resume":
        return this.handleResume(message, server);
      case "skip":
        return this.handleSkip(message, server);
      case "leave":
        return this.handleLeave(message, server);
      case "avatar":
        return this.handleAvatar(message, server);
      default:
        return;
    }
  }

  private async handlePlay(args: string[], message: Message, server: Server): Promise<Message> {
    if (message.member.voice.channel) {
      if (!server.connection) {
        server.connection = await message.member.voice.channel.join();
        server.connection.voice.setSelfDeaf(true);
      }
      if (args.length === 0) {
        return message.channel.send("Invalid input provided, please try again");
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
        console.log(`Server ${server.name}'s queue:  ${server.queue.map(song => `${song.title}\n`)}`);
      }
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleQueueView(message: Message, server: Server): Promise<Message> {
    if (message.member.voice.channel) {
      if (server.queue.length > 0) {
        const before = server.queue
          .slice(0, server.songIndex)
          .map((info, index) => `${index + 1}) ${info.title}\n`)
          .join("");
        const current = server.queue
          .slice(server.songIndex, server.songIndex + 1)
          .map((info) => `**${server.songIndex + 1}) ${info.title} <--- Now Playing**\n`)
          .join("");
        const after = server.queue
          .slice(server.songIndex + 1)
          .map((info, index) => `${server.songIndex + index + 2}) ${info.title}\n`)
          .join("");
        const response = new MessageEmbed()
          .setColor("#0099ff")
          .setTitle("Queue")
          .setDescription(before + current + after);
        return message.channel.send(response);
      } else {
        return message.channel.send("No songs in queue!");
      }
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleVolume(message: Message, server: Server): Promise<Message> {
    if (message.member.voice.channel) {
      const matches = this.volumeRegex.exec(message.content);
      if (server.dispatcher) {
        if (isNaN(parseFloat(matches[1]))) {
          message.channel.send(`The current volume is **${server.volume}%**`);
        } else {
          const provided = parseInt(matches[1]);
          if (provided > 200 || provided < 0) {
            return message.reply("The volume must be a whole number between 0 and 200.");
          } else {
            await message.channel.send(`Changing volume from **${server.volume}%** to **${provided}%**`);
            server.volume = provided;
            server.dispatcher.setVolume(this.scaleVolume(provided));
          }
        }
      } else {
        return message.reply("There currently isn't anything playing");
      }
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleLoop(message: Message, server: Server): Promise<Message> {
    if (message.member.voice.channel) {
      server.isLooping = !server.isLooping;
      if (server.isLooping) {
        return await message.channel.send(`Looping **${server.queue.length} songs**`);
      } else {
        return await message.channel.send(`Looping turned off`);
      }
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleClear(message: Message, server: Server): Promise<Message> {
    if (message.member.voice.channel) {
      server.queue = [];
      return message.channel.send("Cleared queue");
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handlePause(message: Message, server: Server): Promise<Message | MessageReaction> {
    if (message.member.voice.channel) {
      if (!server.dispatcher.paused) {
        server.dispatcher.pause();
        return await message.react("🖐️");
      }
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleResume(message: Message, server: Server): Promise<Message | MessageReaction> {
    if (message.member.voice.channel) {
      if (server.dispatcher.paused) {
        server.dispatcher.resume();
        return await message.react("👌");
      }
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleSkip(message: Message, server: Server) {
    if (message.member.voice.channel) {
      server.dispatcher.end();
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleLeave(message: Message, server: Server): Promise<Message> {
    if (message.member.voice.channel) {
      server.dispatcher?.destroy();
      server.connection?.disconnect();
      server.isPlayingSong = false;
      server.volume = 50;
      this.queueService.clearQueue(message.guild.name);
      await message.react("<:sadge:772667812790927400>");
    } else {
      return message.reply("You must be in a voice channel to use notorious-music-bot");
    }
  }

  private async handleAvatar(message: Message, server: Server): Promise<Message> {
    if (message.mentions.users.size) {
      const member = message.mentions.users.first();
      if (member) {
        const content = new MessageEmbed().setImage(member.displayAvatarURL()).setTitle(member.username);
        return message.channel.send(content);
      } else {
        message.channel.send("No user found with that name, sorry <:sadge:772667812790927400>");
      }
    } else {
      const content = new MessageEmbed().setImage(message.author.displayAvatarURL()).setTitle(message.author.username);
      return message.channel.send(content);
    }
  }

  private async handleYoutube(message: Message, server: Server): Promise<Message> {
    const [_input, url, ...rest] = this.youtubeRegex.exec(message.content);
    const metadata = await this.getMetadata(url, message);
    metadata.song_link = url;
    server.queue.push(metadata);
    if (!server.isPlayingSong) {
      this.playSong(message, server);
    } else {
      const response = new MessageEmbed()
        .setColor("#0099ff")
        .setDescription(`Added [${metadata.title}](${metadata.song_link}) to queue [<@${metadata.added_by}>]`);
      return await message.channel.send(response);
    }
  }

  private async handleSpotify(url: string, message: Message, server: Server): Promise<Message> {
    const [_input, type, uri] = this.spotifyRegex.exec(url);
    switch (type) {
      case "track":
        const track = await this.spotifyService.getTrack(uri);
        const song = await this.prepareSong(`${track.artists[0].name} - ${track.name}`, message, server, track);
        if (!server.isPlayingSong) {
          this.playSong(message, server);
        } else {
          const response = new MessageEmbed()
            .setColor("#0099ff")
            .setDescription(`Added [${track.name}](${song.song_link}) to queue [<@${song.added_by}>]`);
          return await message.channel.send(response);
        }
        break;
      case "album":
        const album = await this.spotifyService.getAlbum(uri);
        const albumSearchQueries = album.map((song) => `${song.artists[0].name} - ${song.name}`);

        await this.prepareSong(albumSearchQueries[0], message, server, album[0]);

        albumSearchQueries.slice(1).reduce(async (promise, query, index) => {
          await promise;
          await this.prepareSong(query, message, server, album[index]);
        }, Promise.resolve());

        if (!server.isPlayingSong) {
          this.playSong(message, server);
        } else {
          return message.channel.send(`Enqueued **${album.length}** songs.`);
        }
      case "playlist":
        const playlist = await this.spotifyService.getPlaylist(uri);
        const playlistSearchQueries = playlist.map((song) => `${song.artists[0].name} - ${song.name}`);

        await this.prepareSong(playlistSearchQueries[0], message, server, playlist[0]);

        playlistSearchQueries.slice(1).reduce(async (promise, query, index) => {
          await promise;
          await this.prepareSong(query, message, server, playlist[index]);
        }, Promise.resolve());

        if (!server.isPlayingSong) {
          this.playSong(message, server);
        } else {
          return message.channel.send(`Enqueued **${playlist.length}** songs.`);
        }
    }
  }

  private async handlePlainInput(args: string[], message: Message, server: Server): Promise<Message> {
    const response = await this.prepareSong(args.join(" "), message, server, null);
    if (!server.isPlayingSong) {
      this.playSong(message, server);
    } else {
      const res = new MessageEmbed()
        .setColor("#0099ff")
        .setDescription(`Added [${response.title}](${response.song_link}) to queue [<@${message.author.id}>]`);
      return await message.channel.send(res);
    }
  }
  private async playSong(message: Message, server: Server) {
    const currentSong = server.queue[server.songIndex];
    server.dispatcher = server.connection.play(ytdl(currentSong.video_url, { filter: "audioonly" }));
    server.dispatcher.setVolume(0.5);
    const response = new MessageEmbed()
      .setColor("#ffffff")
      .setTitle("Now Playing")
      .setDescription(`[${currentSong.title}](${currentSong.song_link}) [<@${currentSong.added_by}>]`);
    await message.channel.send(response);
    server.isPlayingSong = true;
    server.dispatcher.on("finish", async () => {
      if (server.isLooping) {
        if (server.songIndex === server.queue.length - 1) {
          server.songIndex = 0;
        } else {
          server.songIndex++;
        }
      } else {
        server.queue.shift();
      }
      if (server.queue[server.songIndex]) {
        this.playSong(message, server);
      } else {
        server.isPlayingSong = false;
      }
    });
  }
  private async prepareSong(
    query: string,
    message: Message,
    server: Server,
    track: TrackResponse
  ): Promise<YoutubeOembedResponse> {
    const url = await this.youtubeService.searchForSong(query);
    const metadata = await this.getMetadata(url, message);
    if (track) {
      metadata.title = track.name;
      metadata.song_link = track.external_urls.spotify;
    } else {
      metadata.song_link = url;
    }
    server.queue.push(metadata);
    return metadata;
  }

  private async getMetadata(url: string, message: Message): Promise<YoutubeOembedResponse> {
    const metadata = (
      await Axios.get<YoutubeOembedResponse>(`https://www.youtube.com/oembed`, {
        params: { url, format: "json" },
      })
    ).data;
    metadata.video_url = url;
    metadata.added_by = message.author.id;
    return metadata;
  }

  private scaleVolume(provided: number): number {
    return ((2.0 - 0.0) * (provided - 0.0)) / (200 - 0) + 0; // formula for scaling from one range to another
  }

  private tokenize(input: string): Array<string> {
    return input.split(/[; \t]/).slice(1);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
