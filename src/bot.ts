import { Client, Guild, Message, StreamDispatcher } from 'discord.js';
import { inject, injectable } from 'inversify';
import { GuildService } from './services/guild.service';
import { MessageResponder } from './services/message-responder';
import { TYPES } from './types';
import { Server } from './models/guild';

@injectable()
export class Bot {
    servers: Map<string, Server>;

    constructor(
        @inject(TYPES.Client) private client: Client,
        @inject(TYPES.Token) private readonly token: string,
        @inject(TYPES.MessageResponder) private messageResponder: MessageResponder,
        @inject(TYPES.GuildService) private guildService: GuildService
    ) {
        this.servers = new Map<string, Server>();
        this.servers.set('Best Discord Server, Maybe?', new Server('Best Discord Server, Maybe?'));
        this.servers.set('The Boys', new Server('The Boys'));
        this.servers.set('NotoriousPhD\'s test server', new Server('NotoriousPhD\'s test server'));
    }

    listen(): Promise<string> {
        this.client.on('guildCreate', (guild: Guild) => {
            console.log(`Joined a new guild: ${guild.name}`);
            this.guildService.createGuild(guild.name);
            this.servers.set(guild.name, new Server(guild.name));
        });

        this.client.on('message', async (msg: Message) => {
            if (!msg.guild) return; // voice only works in guilds/servers
            if (msg.author.bot) return; // ignore messages from bots
            await this.messageResponder.handle(msg, this.servers.get(msg.guild.name));
        });

        return this.client.login(this.token);
    }
}