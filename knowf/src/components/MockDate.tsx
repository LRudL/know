import React, { useState, useEffect } from "react";
import { dateService } from "../lib/date";

export const MockDate: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(dateService.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(dateService.now());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const addHours = (hours: number) => {
    const newDate = new Date(currentDate.getTime() + hours * 60 * 60 * 1000);
    dateService.setMockedDate(newDate);
  };

  const addDays = (days: number) => {
    const newDate = dateService.addDays(days);
    dateService.setMockedDate(newDate);
  };

  return (
    <div>
      <div>
        Current Date: {currentDate.toISOString().slice(0, 16).replace("T", " ")}
      </div>
      <button onClick={() => addHours(1)}>+1h</button>
      <button onClick={() => addDays(1)}>+1d</button>
    </div>
  );
};

export default MockDate;
