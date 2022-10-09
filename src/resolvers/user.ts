import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import argon2 from 'argon2';
import { MyContext } from '../types';
import { User } from '../entities/User';
import { FORGOT_PASSWORD_PREFIX, USER_SESSION_COOKIE } from '../constants';
import { v4 } from 'uuid';
import { sentEmail } from '../util/sendEmail';

@InputType()
class UsernamePasswordInput {
    @Field()
    email: string;
    @Field()
    username: string;
    @Field()
    password: string;
}

@ObjectType()
class FieldError {
    @Field()
    field: string;

    @Field()
    message: string;
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], { nullable: true })
    errors?: FieldError[];

    @Field(() => User, { nullable: true })
    user?: User;
}

@Resolver()
export class UserResolver {
    @Query(() => User || null, { nullable: true })
    async me(
        @Ctx() { em, req }: MyContext
    ) {
        const id = req.session.userId;

        if (!id) {
            // not logged in
            return null;
        }

        return em.findOneOrFail(User, { id });
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg('email') email: string,
        @Ctx() { em, redis }: MyContext
    ) {
        const user = await em.findOne(User, { email });

        if (!user) {
            return true;
        }

        const token = v4();

        redis.set(FORGOT_PASSWORD_PREFIX + token, user.id, 'EX', 60 * 60);

        const text = `<a href="http://localhost:3000/change-password/${ token }">Reset password</a>`;

        await sentEmail(email, text);

        return true;
    }

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg('token') token: string,
        @Arg('newPassword') newPassword: string,
        @Ctx() { redis, em, req }: MyContext
    ): Promise<UserResponse> {
        if (newPassword.length <= 2) {
            return {
                errors: [{
                    field: 'newPassword',
                    message: 'Password must be at least 2 characters long'
                }]
            };
        }

        const key = FORGOT_PASSWORD_PREFIX + token;
        const id = await redis.get(key);

        if (!id) return {
            errors: [{
                field: 'token',
                message: 'Password reset token has expired'
            }]
        };

        const user = await em.findOne(User, { id: parseInt(id, 10) });

        if (!user) return {
            errors: [{
                field: 'token',
                message: 'Password reset token has expired'
            }]
        };

        user.password = await argon2.hash(newPassword);

        await em.persistAndFlush(user);
        await redis.del(key);

        req.session.userId = user.id;

        return { user }
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx() { req, em }: MyContext
    ): Promise<UserResponse> {
        const { username, password, email } = options;
        const hashedPassword = await argon2.hash(password);

        if (email.trim().length <= 2) {
            return {
                errors: [{
                    field: 'email',
                    message: 'Invalid email'
                }]
            };
        }

        if (username.trim().length <= 2) {
            return {
                errors: [{
                    field: 'username',
                    message: 'Username must be at least 2 characters long'
                }]
            };
        }

        if (username.includes('@')) {
            return {
                errors: [{
                    field: 'username',
                    message: 'Username must not include "@"'
                }]
            };
        }


        if (password.length <= 2) {
            return {
                errors: [{
                    field: 'password',
                    message: 'Password must be at least 2 characters long'
                }]
            };
        }

        const user = em.create(User, { username, password: hashedPassword, email });

        try {
            await em.persistAndFlush(user);
        } catch (err) {
            // Handle Unique violation gracefully
            if (err.code === '23505') {
                return {
                    errors: [{
                        field: 'username',
                        message: 'User already exists'
                    }]
                };
            }
        }

        req.session.userId = user.id;

        return { user };
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('usernameOrEmail', () => String) usernameOrEmail: string,
        @Arg('password', () => String) password: string,
        @Ctx() { em, req }: MyContext
    ): Promise<UserResponse> {
        const user = await em.findOne(User, {
            [
                usernameOrEmail.includes('@')
                    ? 'email'
                    : 'username'
                ]: usernameOrEmail
        });

        if (!user) {
            return {
                errors: [{
                    field: 'username',
                    message: 'User with this username not found'
                }]
            };
        }

        const { password: loadedPasswordHash } = user;
        const passwordMatch = await argon2.verify(loadedPasswordHash, password);

        if (!passwordMatch) {
            return {
                errors: [{
                    field: 'password',
                    message: 'Passwords did not match'
                }]
            };
        }

        req.session.userId = user.id;

        return { user };
    }

    @Mutation(() => Boolean)
    logout(
        @Ctx() { req, res }: MyContext
    ) {
        return new Promise(resolve => req.session.destroy(err => {
            res.clearCookie(USER_SESSION_COOKIE);

            if (err) {
                console.error(err);

                return resolve(false);
            }

            resolve(true);
        }));
    }
}
