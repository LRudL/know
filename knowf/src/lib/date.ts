import { debug } from "./debug";
import { EventEmitter } from "events";

// We have this class because we want to test the spaced repetition algorithm
// i.e. simulate time travel into the future to see if it behaves correctly.

export class DateService {
  private mockDate: Date | null = null;
  private dateEmitter = new EventEmitter();

  now(): Date {
    return this.mockDate || new Date();
  }

  adjustMockDate(days: number, hours: number): void {
    const currentDate = this.now();
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    newDate.setHours(newDate.getHours() + hours);
    this.mockDate = newDate;
    this.dateEmitter.emit("dateChange", newDate);
    debug.log("DateService: Adjusted mock date to", newDate.toISOString());
  }

  resetMockDate(): void {
    this.mockDate = null;
    this.dateEmitter.emit("dateChange", null);
    debug.log("DateService: Reset mock date");
  }

  // Keep existing subscribe method
  subscribe(callback: (date: Date | null) => void): () => void {
    this.dateEmitter.on("dateChange", callback);
    return () => {
      this.dateEmitter.off("dateChange", callback);
    };
  }
}

export const dateService = new DateService();
