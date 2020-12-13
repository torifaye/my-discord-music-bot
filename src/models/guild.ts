import { StreamDispatcher, VoiceConnection } from "discord.js";
import { injectable } from "inversify";
import mongoose, { Document, Schema } from "mongoose";
import { YoutubeOembedResponse } from "./youtube";

@injectable()
export class Server {
    public name: string;
    public isPlayingSong: boolean;
    public isLooping: boolean;
    public queue: Array<YoutubeOembedResponse>;
    public songIndex: number;
    public volume: number;
    public connection?: VoiceConnection;
    public dispatcher?: StreamDispatcher;
    
    constructor(name: string) {
        this.name = name;
        this.volume = 100;
        this.isPlayingSong = false;
        this.songIndex = 0;
        this.isLooping = false;
        this.queue = new Array<YoutubeOembedResponse>();
    }
}

export interface GuildInfo extends Document {
    name: string;
    queue: YoutubeOembedResponse[];
}

const GuildInfoSchema = new Schema({
    name: { type: Schema.Types.String },
    queue: [{
        thumbnail_height: { type: Schema.Types.Number },
        html: { type: Schema.Types.String },
        thumbnail_width: { type: Schema.Types.Number },
        title: { type: Schema.Types.String },
        height: { type: Schema.Types.Number },
        width: { type: Schema.Types.Number },
        type: { type: Schema.Types.String },
        author_name: { type: Schema.Types.String },
        thumbnail_url: { type: Schema.Types.String },
        provider_url: { type: Schema.Types.String },
        provider_name: { type: Schema.Types.String },
        version: { type: Schema.Types.String },
        author_url: { type: Schema.Types.String },
        video_url: { type: Schema.Types.String }
    }]
});

export default mongoose.model<GuildInfo>("GuildInfo", GuildInfoSchema);