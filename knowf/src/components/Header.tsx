import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { debug } from "@/lib/debug";
import { Flex, Text, Button, Separator } from "@radix-ui/themes";

export function Header() {

  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      debug.log("Signed out successfully, redirecting to login");
    } catch (error) {
      debug.error("Error during sign out process:", error);
    } finally {
      // Always redirect to login
      router.push("/login");
    }
  };

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
        width: "100%"
      }}
    >
      <Flex
        className="header-container"
        style={{
          backgroundColor: "var(--accent-9)"
        }}
        display="flex"
        width="100%"
        height="var(--space-9)"
        pl="7"
        align="center"
        gap="7"
      >
        <Text style={{color: "white"}} size="5" weight="bold">
          Socractic
        </Text>
        <Flex className="menu-bar-container" 
          display="flex" 
          py="3" 
          justify="end" 
          align="center" 
          gap="3" 
          flexGrow="1"
        >
          <Flex className="menu-bar" display="flex" px="5" py="1" align="start">
            <Button onClick={() => router.push("/settings")} size="2" variant="solid">Settings</Button>
            <Button size="2" variant="solid">Support</Button>
            <Button onClick={handleSignOut} size="2" variant="solid">Sign Out</Button>
          </Flex>
        </Flex>
      </Flex>
      <Separator orientation="horizontal" size="4"/>
    </header>
  );
}