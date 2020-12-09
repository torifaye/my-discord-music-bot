import 'reflect-metadata';
import { Client } from 'discord.js';
import { Container } from 'inversify';
import { Bot } from './bot';
import { MessageResponder } from './services/message-responder';
import { TYPES } from './types';
import { GuildService } from './services/guild.service';
import { QueueService } from './services/queue.service';
import { SpotifyService } from './services/spotify.sesrvice';
import { YoutubeService } from './services/youtube.service';

let container = new Container({ autoBindInjectable: true });

container.bind<Bot>(TYPES.Bot).to(Bot).inSingletonScope();
container.bind<Client>(TYPES.Client).toConstantValue(new Client());

container.bind<MessageResponder>(TYPES.MessageResponder).to(MessageResponder);
container.bind<GuildService>(TYPES.GuildService).to(GuildService);
container.bind<QueueService>(TYPES.QueueService).to(QueueService);
container.bind<SpotifyService>(TYPES.SpotifyService).to(SpotifyService);
container.bind<YoutubeService>(TYPES.YoutubeService).to(YoutubeService);

container.bind<string>(TYPES.Token).toConstantValue(process.env.TOKEN);
container.bind<string>(TYPES.ClientId).toConstantValue(process.env.CLIENT_ID);
container.bind<string>(TYPES.ClientSecret).toConstantValue(process.env.CLIENT_SECRET);
container.bind<string>(TYPES.MongoUser).toConstantValue(process.env.MONGO_USER);
container.bind<string>(TYPES.MongoPassword).toConstantValue(process.env.MONGO_PASSWORD);
container.bind<string>(TYPES.MongoHost).toConstantValue(process.env.MONGO_HOST);
container.bind<string>(TYPES.MongoPort).toConstantValue(process.env.MONGO_PORT);
container.bind<string>(TYPES.MongoDbName).toConstantValue(process.env.MONGO_DBNAME);
container.bind<string>(TYPES.MongoAuthSource).toConstantValue(process.env.MONGO_AUTH_SOURCE);

export default container;