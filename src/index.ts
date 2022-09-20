import {MikroORM} from '@mikro-orm/core';
import microConfig from './mikro-orm.config';
import express from 'express';
import {buildSchema} from 'type-graphql';
import {ApolloServer} from 'apollo-server-express';
import {PostResolver} from './resolvers/post';
import {UserResolver} from './resolvers/user';
import {createClient} from "redis";
import connectRedis from 'connect-redis';
import session from 'express-session';
import {MyContext} from "./types";

const main = async () => {
    const orm = await MikroORM.init(microConfig);
    const app = express();
    const RedisStore = connectRedis(session);
    const redisClient = createClient({legacyMode: true});

    redisClient.connect().catch((err) => console.error('Redis conection error: ' + err?.message));
    app.set("trust proxy", 1);

    app.use(
        session({
            name: 'qid',
            store: new RedisStore({
                client: redisClient,
                disableTouch: true
            }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
                httpOnly: true,
                sameSite: 'none',
                secure: true
            },
            secret: "secret to hide in .env",
            resave: false,
        })
    )

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [
                PostResolver,
                UserResolver
            ],
            validate: false
        }),
        context: ({req, res}): MyContext => ({
            em: orm.em,
            req,
            res
        })
    });

    await apolloServer.start();
    await orm.getMigrator().up();

    apolloServer.applyMiddleware({
        app,
        cors: {
            origin: ["http://localhost:3003/graphql", "https://studio.apollographql.com"],
            credentials: true,
            exposedHeaders: '*'
        },
    });

    return app.listen(3003, () => {
        console.log('Server started on localhost:3003');
    });

};

main().catch(console.error);
