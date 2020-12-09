import { injectable } from "inversify";
import Guild, { GuildInfo } from "../models/guild";

@injectable()
export class GuildService {
    public async getGuild(guild: string): Promise<GuildInfo> {
        return await Guild.findOne({"name": guild});
    }

    public async createGuild(name: string) {
        await Guild.create({name: name, queue: []});
    }
}