import {__prod__} from './constants';
import { Post } from './entities/Post';
import { Options } from '@mikro-orm/core';
import path from 'path';

export default {
    migrations: {
        path: path.join(__dirname, 'migrations'),
        pattern: /^[\w-]+\d+\.[tj]s$/
    },
    dbName: 'lireddit',
    debug: !__prod__,
    user: 'postgres',
    password: 'diakiwa6439935',
    type: 'postgresql',
    entities: [Post]
} as Options;
