// src/components/auth/AuthForm.tsx
import { Flex, Text, TextField, Button, Separator } from "@radix-ui/themes";
import Link from "next/link";

interface AuthFormProps {
  mode: "login" | "signup";
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  errorMsg: string | null;
}

export function AuthForm({
  mode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  errorMsg,
}: AuthFormProps) {
  const isLogin = mode === "login";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Flex
      className="sign-up-background"
      style={{
        backgroundColor: "black",
      }}
      p="0"
      display="flex"
      width="100%"
      height="100vh"
      justify="end"
    >
      <Flex
        className="sign-up-panel"
        style={{
          alignSelf: "stretch",
          backgroundColor: "var(--color-background)",
        }}
        display="flex"
        width="33vw"
        px="7"
        py="9"
        direction="column"
        justify="between"
        align="start"
      >
        <Flex
          className="blank-alignment"
          style={{ alignSelf: "stretch" }}
          display="flex"
          height="27px"
          align="start"
        />
        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <Flex
            className="sign-up-form"
            display="flex"
            direction="column"
            align="start"
            gap="9"
          >
            <Flex
              className="sign-up-title"
              display="flex"
              direction="column"
              align="start"
              gap="5"
            >
              <Text size="6" weight="bold">
                {isLogin ? "Login" : "Sign Up"}
              </Text>
              <Text size="6" weight="medium">
                {isLogin ? "back to" : "to start"} learning at the frontier
              </Text>
            </Flex>
            <Flex
              className="sign-up-form"
              display="flex"
              direction="column"
              align="start"
              gap="5"
            >
              <Flex
                className="email-field"
                display="flex"
                direction="column"
                align="start"
                gap="3"
              >
                <Text size="2" weight="medium">
                  Email
                </Text>
                <TextField.Root
                  type="email"
                  onChange={(event) => setEmail(event.target.value)}
                  size="2"
                  variant="surface"
                  placeholder="Enter email"
                />
              </Flex>
              <Flex
                className="password-field"
                display="flex"
                direction="column"
                align="start"
                gap="3"
              >
                <Text size="2" weight="medium">
                  Password
                </Text>
                <TextField.Root
                  type="password"
                  onChange={(event) => setPassword(event.target.value)}
                  size="2"
                  variant="surface"
                  placeholder="Enter password"
                />
              </Flex>
            </Flex>
            <Button type="submit" size="2" variant="solid">
              {isLogin ? "Login" : "Sign Up"}
            </Button>
          </Flex>
        </form>
        <Flex
          className="footer"
          style={{ alignSelf: "stretch" }}
          display="flex"
          direction="column"
          align="start"
          gap="3"
        >
          <Separator size="4" orientation="horizontal" />
          <Text size="2" weight="regular">
            {isLogin ? "Don't have" : "Have"} an account?{" "}
            <Link
              href={isLogin ? "/signup" : "/login"}
              className="text-blue-500"
            >
              {isLogin ? "Sign Up" : "Login"}
            </Link>
          </Text>
        </Flex>
        {errorMsg && (
          <div className="text-red-600 text-sm mt-2">{errorMsg}</div>
        )}
      </Flex>
    </Flex>
  );
}
