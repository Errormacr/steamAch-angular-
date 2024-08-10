"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const cors = require("cors");
class SteamDataFetcher {
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
    fetchData(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, maxRetries = 3) {
            let attempts = 0;
            while (attempts < maxRetries) {
                try {
                    const response = yield fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch data from ${url}. Status: ${response.status}`);
                    }
                    return response.json();
                }
                catch (error) {
                    attempts++;
                    console.error(`Attempt ${attempts} failed: ${error.message}`);
                    yield new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            throw new Error(`Failed to fetch data from ${url} after ${maxRetries} attempts`);
        });
    }
    get_data(urls_a, ip, key, lang) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const q = {};
                const responses = yield Promise.all(urls_a.map((appid) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const ach_url = `http://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid[0]}&key=${key}&steamid=${ip}&l=${lang}`;
                        const perc_url = `http://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid[0]}&format=json`;
                        const ico_url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?appid=${appid[0]}&key=${key}&l=${lang}`;
                        const urls = [ach_url, perc_url, ico_url];
                        const data = yield Promise.all([
                            ...urls.map(url => this.fetchData(url)),
                            { appid: appid[0] },
                            { last_launch_time: appid[1] },
                            { playtime: appid[2] }
                        ]);
                        return data;
                    }
                    catch (err) {
                        q[appid[0]] = err;
                        console.log(q);
                        console.error(appid);
                        return null;
                    }
                })));
                const results = responses.filter((data) => {
                    return data && data[0].playerstats.gameName && data[1].achievementpercentages.achievements && data[0].playerstats.achievements && data[2].game;
                });
                const ret_data = results.map((data) => {
                    try {
                        const arr1 = data[1].achievementpercentages.achievements;
                        const arr2 = data[0].playerstats.achievements;
                        const arr3 = data[2].game.availableGameStats.achievements;
                        const mergedArray = arr3.reduce((acc, curr) => {
                            const matchingObjInArr2 = arr2.find((obj) => obj.apiname === curr.name);
                            matchingObjInArr2 === null || matchingObjInArr2 === void 0 ? true : delete matchingObjInArr2.apiname;
                            let matchingObjInArr3 = arr1.find((obj) => obj.name === curr.name);
                            if (!matchingObjInArr3) {
                                matchingObjInArr3 = { name: curr.name, percent: 0.1 };
                            }
                            if (matchingObjInArr2 && matchingObjInArr3) {
                                acc.push(Object.assign(Object.assign(Object.assign({}, curr), matchingObjInArr2), matchingObjInArr3));
                            }
                            return acc;
                        }, []);
                        return { appid: data[3].appid, last_launch_time: data[4].last_launch_time, playtime: data[5].playtime, gameName: data[0].playerstats.gameName, Achievement: mergedArray };
                    }
                    catch (error) {
                        console.log(error);
                        return error;
                    }
                });
                return ret_data;
            }
            catch (error) {
                console.error(error);
                throw new Error('An error occurred while retrieving data from Steam Web API');
            }
        });
    }
    getPersonData(key, ids) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(`http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${ids}`);
                const data = yield response.json();
                return data.response.players;
            }
            catch (error) {
                console.error('Error fetching person data:', error);
                return [];
            }
        });
    }
    handleDataRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const array = req.body.appid;
            const { steam_id, key, lang } = req.query;
            if (isNaN(Number(steam_id))) {
                res.send('steam_id must be a number');
                return;
            }
            try {
                const data = yield this.get_data(JSON.parse(array), steam_id, key, lang);
                res.send(data);
            }
            catch (err) {
                res.send(err.message);
            }
        });
    }
    handleRecentRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = req.query.key;
            const id = req.query.id;
            if (isNaN(Number(id))) {
                res.send('steam_id must be a number');
                return;
            }
            try {
                const response = yield fetch(`http://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${id}&format=json`);
                const data = yield response.json();
                res.send(data);
            }
            catch (err) {
                res.send(err.message);
            }
        });
    }
    handlePlayerSumRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = req.query.key;
            let id = req.query.id;
            if (!id) {
                res.status(400).send("Parameter 'id' is required");
                return;
            }
            if (id.includes(',')) {
                id = id.replace(/,/g, ',');
            }
            try {
                const data = yield this.getPersonData(key, id);
                res.send(data);
            }
            catch (err) {
                res.send(err.message);
            }
        });
    }
    handleOwnedGamesRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = req.query.key;
            const id = req.query.id;
            if (isNaN(Number(id))) {
                res.send('steam_id must be a number');
                return;
            }
            try {
                const response = yield fetch(`http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${id}&format=json`);
                const data = yield response.json();
                res.send(data);
            }
            catch (err) {
                res.send(err.message);
            }
        });
    }
}
exports.default = SteamDataFetcher;
//# sourceMappingURL=server.js.map