import Axios from "axios";
import { inject, injectable } from "inversify";
import { TYPES } from "../types";


export interface YoutubeAPIResponse {
    kind: 'youtube#searchListResponse';
    etag: string;
    nextPageToken: string;
    prevPageToken: string;
    regionCode: string;
    pageInfo: {
        totalResults: number;
        resultsPerPage: number;
    };
    items: {
        kind: "youtube#searchResult",
        id: {
            kind: "youtube#video";
            videoId: string;
        }
        snippet: {
            title: string;
        }
    }[];

}

@injectable()
export class YoutubeService {

    public async searchForSong(query: string): Promise<string> {
        const html = (await Axios.get<string>('https://www.youtube.com/results',
            {
                responseType: 'text',
                headers: {
                    'Content-Type': 'text/html'
                },
                params: {
                    search_query: query.replace(' ', '+')
                }
            })).data;

        const dataLocation = html.split('var ytInitialData = ')[1];
        const data = JSON.parse(dataLocation.slice(0, dataLocation.indexOf('</script>') - 1));
        const results = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents;
        const videoIds = results.filter((result: any) => result.hasOwnProperty('videoRenderer')).map((result: any) => result.videoRenderer.videoId);
        return `https://youtube.com/watch?v=${videoIds[0]}`;
    }
}