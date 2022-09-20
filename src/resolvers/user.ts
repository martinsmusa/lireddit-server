import {Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver} from 'type-graphql';
import argon2 from 'argon2';
import {MyContext} from '../types';
import {User} from '../entities/User';

@InputType()
class UsernamePasswordInput {
    @Field()
    username: string
    @Field()
    password: string
}

@ObjectType()
class FieldError {
    @Field()
    field: string

    @Field()
    message: string
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError[]

    @Field(() => User, {nullable: true})
    user?: User
}

@Resolver()
export class UserResolver {
    @Query(() => User || null, {nullable: true})
    async me(
        @Ctx() {em, req}: MyContext
    ) {
        const id = req.session.userId;

        if (!id) {
            // not logged in
            return null;
        }

        return em.findOneOrFail(User, {id});
    }

    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UsernamePasswordInput,
        @Ctx() {req, em}: MyContext
    ): Promise<UserResponse> {
        const {username, password} = options;
        const hashedPassword = await argon2.hash(password);

        if (username.trim().length <= 2) {
            return {
                errors: [{
                    field: 'username',
                    message: 'Username must be at least 2 characters long'
                }]
            }
        }

        if (password.length <= 2) {
            return {
                errors: [{
                    field: 'password',
                    message: 'Password must be at least 2 characters long'
                }]
            }
        }

        const user = em.create(User, {username, password: hashedPassword});

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
                }
            }
        }

        req.session.userId = user.id;

        return {user};
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg('auth', () => UsernamePasswordInput) auth: UsernamePasswordInput,
        @Ctx() {em, req}: MyContext
    ): Promise<UserResponse> {
        const {username, password: formPassword} = auth;
        const user = await em.findOne(User, {username});

        if (!user) {
            return {
                errors: [{
                    field: 'username',
                    message: 'User with this username not found'
                }]
            }
        }

        const {password: loadedPasswordHash} = user;
        const passwordMatch = await argon2.verify(loadedPasswordHash, formPassword);

        if (!passwordMatch) {
            return {
                errors: [{
                    field: 'password',
                    message: 'Passwords did not match'
                }]
            }
        }

        req.session.userId = user.id;

        return {
            user
        }
    }
}