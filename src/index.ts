import { MikroORM } from '@mikro-orm/core';
import microConfig from './mikro-orm.config';
import express from 'express';
import { buildSchema } from 'type-graphql';
import { ApolloServer } from 'apollo-server-express';
import { HelloResolver } from './resolvers/hello';
import { PostResolver } from './resolvers/post';


const main = async () => {
    const orm = await MikroORM.init(microConfig);
    const app = express();
    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [
                HelloResolver,
                PostResolver
            ],
            validate: false
        }),
        context: () => ({ em: orm.em })
    });
    await apolloServer.start();
    await orm.getMigrator().up();

    apolloServer.applyMiddleware({ app });

    app.listen(3003, () => {
        console.log('Server started on localhost:3003');
    });
};

main().catch(console.error);
