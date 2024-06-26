import { getServerSession } from "next-auth/next";
import { signIn } from "next-auth/react";
import { BsGithub, BsGoogle } from "react-icons/bs";

import BlankLayout from "@components/layouts/BlankLayout";
import { authOptions } from "pages/api/auth/[...nextauth]";
import Button from "@components/Button";
import Link from "@components/Link";
import Logo from "@public/logos/Logo";


export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (session) {
    return { redirect: { destination: "/account/onboarding" } };
  }

  return {
    props: {},
  };
}

export default function SignIn() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm space-y-8 min-w-max">
        <Link href="/">
          <Logo className="w-1/2" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-primary-medium flex flex-col">
          <span>Connect to YOUR network</span>
          <span className="text-tertiary-medium">with a single link</span>
        </h2>

        <Button primary={true} key="github" onClick={() => signIn("github")}>
          <span className="mr-2">
            <BsGithub className="text-2xl" />
          </span>
          Continue with GitHub
        </Button>

        <Button primary={true} key="google" onClick={() => signIn("google")}>
          <span className="mr-2">
            <BsGoogle className="text-2xl" />
          </span>
          Continue with Google
        </Button>
        
        {/* <Button primary={true} key="google2" onClick={() => {
  console.log("Google sign-in clicked");
  signIn("google");
}}>
  <span className="mr-2">
    <BsGoogle className="text-2xl" />
  </span>
  Continue with Google
</Button> */}


       {/* <p className="mt-10 text-center text-sm text-primary-low-medium">
          Don&lsquo;t have a GitHub account? Create one on{" "}
          <Link href="https://github.com/signup" target="_blank">
            GitHub
          </Link>
</p> */}
      </div>
    </div>
  );
}

SignIn.getLayout = function getLayout(page) {
  return <BlankLayout>{page}</BlankLayout>;
};
