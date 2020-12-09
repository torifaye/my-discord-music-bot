import { injectable } from "inversify";
import { YoutubeOembedResponse } from "../models/youtube";
import GuildInfo from '../models/guild';

@injectable()
export class QueueService {
    public async getQueue(guild: string): Promise<YoutubeOembedResponse[]> {
        const res = await GuildInfo.findOne({ "name": guild });
        return res.queue;
    }

    public async addToQueue(guild: string, video: YoutubeOembedResponse) {
        const server = await GuildInfo.findOne({ "name": guild });
        await GuildInfo.updateOne({ _id: server._id }, { "$push": { queue: video } });
    }

    public async shiftQueue(guild: string) {
        const server = await GuildInfo.findOne({ "name": guild });
        await GuildInfo.updateOne({ _id: server._id }, { "$pop": { "queue": -1 } });
    }

    public async clearQueue(guild: string) {
        const server = await GuildInfo.findOne({ "name": guild });
        await GuildInfo.updateOne({ _id: server._id }, { "$set": { "queue": [] } });
    }
}