import { Resolver, Query, Ctx, Int, Arg, Mutation } from 'type-graphql';
import { Post } from '../entities/Post';
import { MyContext } from '../types';

@Resolver()
export class PostResolver {
    @Mutation(() => Post, { nullable: true })
    async createPost(
        @Arg('title', () => String) title: string,
        @Ctx() { em }: MyContext
    ): Promise<Post> {
        const post = em.create(Post, { title });
        await em.persistAndFlush(post);

        return post;
    }

    @Query(() => [Post], { nullable: true })
    posts(
        @Ctx() { em }: MyContext
    ): Promise<Post[]> {
        return em.find(Post, {});
    }

    @Query(() => [Post])
    post(
        @Arg('id', () => Int) id: number,
        @Ctx() { em }: MyContext
    ): Promise<Post | null> {
        return em.findOne(Post, { id });
    }

    @Mutation(() => Post, { nullable: true })
    async updatePost(
        @Arg('id', () => Int) id: number,
        @Arg('title', () => String) title: string,
        @Ctx() { em }: MyContext
    ): Promise<Post | null> {
        const post = await em.findOne(Post, { id });

        if (!post) {
            return null;
        }

        post.title = title

        await em.persistAndFlush(post);

        return post;
    }

    @Mutation(() => Int)
    async deletePost(
        @Arg('id', () => Int) id: number,
        @Ctx() { em }: MyContext
    ): Promise<number | null> {
        return em.nativeDelete(Post, { id });
    }
}
