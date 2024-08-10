import * as express from 'express';
import * as cors from 'cors';

export default class SteamDataFetcher {
  private app: express.Express;

  constructor() {
    this.app = express();
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: '*',
    }));
    this.app.use(express.json());
    this.app.post('/data', this.handleDataRequest.bind(this));
    this.app.get('/recent', this.handleRecentRequest.bind(this));
    this.app.get('/player_sum', this.handlePlayerSumRequest.bind(this));
    this.app.get('/owned', this.handleOwnedGamesRequest.bind(this));
    this.app.listen(4500, () => {
      console.log('listening on 4500');
    });
  }

  private async fetchData(url: string, maxRetries: number = 3): Promise<any> {
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch data from ${url}. Status: ${response.status}`);
        }

        return response.json();
      } catch (error: any) {
        attempts++;
        console.error(`Attempt ${attempts} failed: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to fetch data from ${url} after ${maxRetries} attempts`);
  }

  private async get_data(urls_a: any[], ip: string, key: string, lang: string): Promise<any[]> {
    try {
      const q: any = {};
      const responses = await Promise.all(urls_a.map(async (appid) => {
        try {
          const ach_url = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid[0]}&key=${key}&steamid=${ip}&l=${lang}`;
          const perc_url = `http://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid[0]}&format=json`;
          const ico_url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?appid=${appid[0]}&key=${key}&l=${lang}`;
          const urls = [ach_url, perc_url, ico_url];

          const data = await Promise.all([
            ...urls.map(url => this.fetchData(url)),
            { appid: appid[0] },
            { last_launch_time: appid[1] },
            { playtime: appid[2] }
          ]);

          return data;
        } catch (err) {
          q[appid[0]] = err;
          console.log(q);
          console.error(appid);
          return null;
        }
      }));
      const results = responses.filter((data) => {
        return data && data[0].playerstats.gameName && data[1].achievementpercentages.achievements && data[0].playerstats.achievements && data[2].game;
      });
      const ret_data = results.map((data: any) => {
        try {
          const arr1 = data[1].achievementpercentages.achievements;
          const arr2 = data[0].playerstats.achievements;
          const arr3 = data[2].game.availableGameStats.achievements;
          const mergedArray = arr3.reduce((acc: any[], curr: any) => {
            const matchingObjInArr2 = arr2.find((obj: { apiname: any; }) => obj.apiname === curr.name);
            delete matchingObjInArr2?.apiname;
            let matchingObjInArr3 = arr1.find((obj: { name: any; }) => obj.name === curr.name);
            if (!matchingObjInArr3) {
              matchingObjInArr3 = { name: curr.name, percent: 0.1 };
            }
            if (matchingObjInArr2 && matchingObjInArr3) {
              acc.push({ ...curr, ...matchingObjInArr2, ...matchingObjInArr3 });
            }
            return acc;
          }, [] as any[]);

          return { appid: data[3].appid, last_launch_time: data[4].last_launch_time, playtime: data[5].playtime, gameName: data[0].playerstats.gameName, Achievement: mergedArray };
        } catch (error) {
          console.log(error);
          return error;
        }
      });

      return ret_data;
    } catch (error) {
      console.error(error);
      throw new Error('An error occurred while retrieving data from Steam Web API');
    }
  }

  private async getPersonData(key: string, ids: string): Promise<any[]> {
    try {
      const response = await fetch(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${ids}`);
      const data: any = await response.json();
      return data.response.players;
    } catch (error) {
      console.error('Error fetching person data:', error);
      return [];
    }
  }

  private async handleDataRequest(req: express.Request, res: express.Response): Promise<void> {
    const array = req.body.appid;
    const { steam_id, key, lang } = req.query;
    if (isNaN(Number(steam_id))) {
      res.send('steam_id must be a number');
      return;
    }
    try {
      const data = await this.get_data(JSON.parse(array), steam_id as string, key as string, lang as string);
      res.send(data);
    } catch (err: any) {
      res.send(err.message);
    }
  }

  private async handleRecentRequest(req: express.Request, res: express.Response): Promise<void> {
    const key = req.query.key as string;
    const id = req.query.id as string;

    if (isNaN(Number(id))) {
      res.send('steam_id must be a number');
      return;
    }

    try {
      const response = await fetch(`http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${id}&format=json`);
      const data = await response.json();
      res.send(data);
    } catch (err: any) {
      res.send(err.message);
    }
  }

  private async handlePlayerSumRequest(req: express.Request, res: express.Response): Promise<void> {
    const key = req.query.key as string;
    let id = req.query.id as string;

    if (!id) {
      res.status(400).send("Parameter 'id' is required");
      return;
    }

    if (id.includes(',')) {
      id = id.replace(/,/g, ',');
    }

    try {
      const data = await this.getPersonData(key, id);
      res.send(data);
    } catch (err: any) {
      res.send(err.message);
    }
  }

  private async handleOwnedGamesRequest(req: express.Request, res: express.Response): Promise<void> {
    const key = req.query.key as string;
    const id = req.query.id as string;

    if (isNaN(Number(id))) {
      res.send('steam_id must be a number');
      return;
    }

    try {
      const response = await fetch(`http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${id}&format=json`);
      const data = await response.json();
      res.send(data);
    } catch (err: any) {
      res.send(err.message);
    }
  }
}
