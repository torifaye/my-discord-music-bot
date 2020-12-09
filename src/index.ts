require('dotenv').config();

import container from './inversify.config';
import { TYPES } from './types';
import { Bot } from './bot';
import mongoose from 'mongoose';

const mongoUser = container.get<string>(TYPES.MongoUser);
const mongoPass = container.get<string>(TYPES.MongoPassword);
const mongoHost = container.get<string>(TYPES.MongoHost);
const mongoPort = container.get<string>(TYPES.MongoPort);
const mongoDbName = container.get<string>(TYPES.MongoDbName);
const mongoAuthSource = container.get<string>(TYPES.MongoAuthSource);

mongoose.connect(`mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/${mongoDbName}`,
    { useNewUrlParser: true, useUnifiedTopology: true, authSource: mongoAuthSource, w: 1 })
    .then(() => {
        console.log('connected to mongo!')
    })
    .catch((error) => {
        console.error(error);
    });

let bot = container.get<Bot>(TYPES.Bot);

bot.listen().then(() => {
    console.log('logged into discord!');
}).catch(error => {
    console.error(error);
});
