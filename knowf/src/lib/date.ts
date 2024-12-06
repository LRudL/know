import { debug } from "./debug";

// We have this class because we want to test the spaced repetition algorithm
// i.e. simulate time travel into the future to see if it behaves correctly.

export class DateService {
  private static instance: DateService;
  private mockedDate: Date | null = null;

  private constructor() {}

  static getInstance(): DateService {
    if (!DateService.instance) {
      DateService.instance = new DateService();
    }
    return DateService.instance;
  }

  /**
   * Get the current date, either real or mocked
   */
  now(): Date {
    return this.mockedDate || new Date();
  }

  /**
   * Set a mocked date for testing
   */
  setMockedDate(date: Date | null) {
    this.mockedDate = date;
    debug.log("DateService: Mocked date set to", date?.toISOString() || "null");
  }

  /**
   * Add days to current date
   */
  addDays(days: number): Date {
    const currentDate = this.now();
    return new Date(currentDate.getTime() + days * 24 * 60 * 60 * 1000);
  }

  addHours(hours: number): Date {
    const currentDate = this.now();
    return new Date(currentDate.getTime() + hours * 60 * 60 * 1000);
  }

  /**
   * Clear any mocked date and return to real time
   */
  clearMockedDate() {
    this.mockedDate = null;
    debug.log("DateService: Cleared mocked date");
  }
}

// Export a singleton instance
export const dateService = DateService.getInstance();
