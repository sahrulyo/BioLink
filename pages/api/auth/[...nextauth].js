import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { ObjectId } from "bson";
import { serverEnv } from "@config/schemas/serverSchema";
import stripe from "@config/stripe";
import DbAdapter from "./db-adapter";
import connectMongo from "@config/mongo";
import { Account, Link, Profile, User } from "@models/index";
import {
  getAccountByProviderAccountId,
  associateProfileWithAccount,
} from "../account/account";
import logger from "@config/logger";

export const authOptions = {
  adapter: DbAdapter(connectMongo),
  providers: [
    GithubProvider({
      clientId: serverEnv.GITHUB_ID,
      clientSecret: serverEnv.GITHUB_SECRET,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          username: profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
    GoogleProvider({
      clientId: serverEnv.GOOGLE_ID,
      clientSecret: serverEnv.GOOGLE_SECRET,
      // authorizationUrl: `https://accounts.google.com/o/oauth2/auth?response_type=code&prompt=consent&access_type=offline&redirect_uri=${serverEnv.GOOGLE_REDIRECT_URL}`,
      // profile(profile) {
      //   return {
      //     id: profile.sub,
      //     name: profile.name,
      //     username: profile.email.split('@')[0],
      //     email: profile.email,
      //     image: profile.picture,
      //   };
      // },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      await connectMongo();

      if (account.provider === 'github') {
        await Account.findOneAndUpdate(
          { userId: user.id },
          {
            github: {
              company: profile.company,
              publicRepos: profile.public_repos,
              followers: profile.followers,
              following: profile.following,
            },
          },
          { upsert: true },
        );
      }

      if (account.provider === 'google') {
        await Account.findOneAndUpdate(
          { userId: user.id },
          {
            google: {
              email: profile.email,
              name: profile.name,
              picture: profile.picture,
            },
          },
          { upsert: true },
        );
      }

      return true;
    },
    async redirect({ baseUrl }) {
      return `${baseUrl}/account/onboarding`;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.id = profile.id;
        token.username = profile.login || profile.email.split('@')[0];
      }
      return token;
    },
    async session({ session, token }) {
      await connectMongo();
      session.accessToken = token.accessToken;
      session.user.id = token.sub;
      session.username = token.username;

      const user = await User.findOne({ _id: token.sub });
      if (user) {
        session.accountType = user.type;
        session.stripeCustomerId = user.stripeCustomerId;
      } else {
        session.accountType = "free";
        session.stripeCustomerId = null;
      }

      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  events: {
    async signIn({ profile, account }) {
      await connectMongo();
      const username = profile.login || profile.email.split('@')[0];
      const defaultLink = (profileId) => ({
        username,
        name: account.provider === 'github' ? "GitHub" : "Google",
        url: account.provider === 'github' ? `https://github.com/${username}` : `https://plus.google.com/${profile.sub}`,
        icon: account.provider === 'github' ? "FaGithub" : "FaGoogle",
        isEnabled: true,
        isPinned: true,
        animation: "glow",
        profile: new ObjectId(profileId),
      });

      const userAccount = await getAccountByProviderAccountId(profile.id);
      const user = await User.findOne({ _id: userAccount.userId });

      let userProfile = await Profile.findOne({ username });
      if (!userProfile) {
        logger.info("profile not found for: ", username);
        userProfile = await Profile.findOneAndUpdate(
          { username },
          {
            source: "database",
            name: profile.name,
            bio: "Have a look at my BioDrop Profile!",
            user: userAccount.userId,
          },
          { new: true, upsert: true },
        );
        const link = await Link.create([defaultLink(userProfile._id)], { new: true });
        userProfile = await Profile.findOneAndUpdate(
          { username },
          { $push: { links: new ObjectId(link[0]._id) } },
          { new: true },
        );
      }

      await associateProfileWithAccount(userAccount, userProfile._id);

      if (!user.stripeCustomerId) {
        logger.info("user stripe customer id not found for: ", user.email);
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: userAccount.userId,
            provider: account.provider,
            username,
          },
        });
        await User.findOneAndUpdate(
          { _id: new ObjectId(userAccount.userId) },
          { stripeCustomerId: customer.id, type: "free" },
        );
      }

      if (userProfile.links.length === 0) {
        logger.info("no links found for: ", username);
        const link = await Link.create([defaultLink(userProfile._id)], { new: true });
        await Profile.findOneAndUpdate(
          { username },
          { $push: { links: new ObjectId(link[0]._id) } },
        );
      }
    },
  },
};

export default NextAuth(authOptions);
