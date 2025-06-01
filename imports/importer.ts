import pino from "pino";

export type ImportUnit = {
  code: string;
  name: string;
  level: number;
  creditPoints: number;
  facultyName: string;
  offerings: {
    location: string;
    period: string;
  }[];
};

export abstract class Importer {
  university: string;
  protected logger: pino.Logger;

  constructor(university: string, logger: pino.Logger) {
    this.university = university;
    this.logger = logger.child({ university });
  }

  abstract getUnits(): Promise<ImportUnit[]>;
}
