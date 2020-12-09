import Axios from "axios";
import FormData from "form-data";
import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { stringify } from 'querystring';

interface TrackResponse {
    album: { name: string };
    artists: { name: string }[];
    name: string;
}

interface PaginatedTracklistResponse {
    items: TrackResponse[];
    next: string;
}

@injectable()
export class SpotifyService {
    constructor(
        @inject(TYPES.ClientId) private readonly clientId: string,
        @inject(TYPES.ClientSecret) private readonly clientSecret: string
    ) { }

    public async getTrack(id: string): Promise<TrackResponse> {
        const token = await this.authenticate();
        const track = (await Axios.get<TrackResponse>(`https://api.spotify.com/v1/tracks/${id}`, {
            headers: {
                authorization: `Bearer ${token}`
            }
        })).data;

        return track;
    }

    public async getAlbum(id: string): Promise<TrackResponse[]> {
        const token = await this.authenticate();
        const results: TrackResponse[] = [];
        let tracks = (await Axios.get<PaginatedTracklistResponse>(`https://api.spotify.com/v1/albums/${id}/tracks`, {
            params: {
                offset: 0,
                limit: 50
            },
            headers: {
                authorization: `Bearer ${token}`
            }
        })).data;

        tracks.items.forEach(track => results.push(track));

        while (tracks.next != null) {
            tracks = (await Axios.get<PaginatedTracklistResponse>(tracks.next, {
                headers: {
                    authorization: `Bearer ${token}`
                }
            })).data;

            tracks.items.forEach(track => results.push(track));
        }

        return results;
    }

    public async getPlaylist(id: string): Promise<TrackResponse[]> {
        const token = await this.authenticate();
        const results: TrackResponse[] = [];
        let tracks = (await Axios.get<PaginatedTracklistResponse>(`https://api.spotify.com/v1/playlists/${id}/tracks`, {
            params: {
                offset: 0,
                limit: 100
            },
            headers: {
                authorization: `Bearer ${token}`
            }
        })).data;

        tracks.items.forEach(track => results.push(track));

        while (tracks.next != null) {
            tracks = (await Axios.get<PaginatedTracklistResponse>(tracks.next, {
                headers: {
                    authorization: `Bearer ${token}`
                }
            })).data;

            tracks.items.forEach(track => results.push(track));
        }

        return results;
    }

    private async authenticate(): Promise<string> {
        const payload = stringify({ grant_type: 'client_credentials' });
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`);

        const res = await Axios.post<{ "access_token": string, "token_type": string, "expires_in": number, "scope": string }>(`https://accounts.spotify.com/api/token`, payload, {
            headers: {
                Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return res.data.access_token;
    }
}