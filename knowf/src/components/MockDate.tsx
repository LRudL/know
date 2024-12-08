import { Button, Flex } from "@radix-ui/themes";
import { dateService } from "../lib/date";
import { useQueryClient } from "@tanstack/react-query";

export function MockDate() {
  const queryClient = useQueryClient();

  const handleDateChange = (days: number) => {
    dateService.adjustMockDate(days, 0);
    // Invalidate all learning state queries since they depend on the current date
    queryClient.invalidateQueries({ queryKey: ["learningState"] });
  };

  return (
    <Flex direction="column" gap="2">
      <div style={{ fontWeight: 'bold' }}>Mock Date</div>
      <div>Current Date: {dateService.now().toLocaleString()}</div>
      <Flex gap="2">
        <Button 
          size="1" 
          variant="soft" 
          onClick={() => handleDateChange(-1)}
        >
          -1d
        </Button>
        <Button 
          size="1" 
          variant="soft" 
          onClick={() => handleDateChange(1)}
        >
          +1d
        </Button>
      </Flex>
    </Flex>
  );
}

export default MockDate;
