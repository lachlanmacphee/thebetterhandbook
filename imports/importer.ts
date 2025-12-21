import pino from "pino";

export type ImportUnit = {
  code: string;
  name: string;
  level: string;
  creditPoints: number;
  facultyName: string;
  offerings: {
    location: string;
    period: string;
  }[];
};

export abstract class Importer {
  university: string;
  handbookUrl: string;
  unitOutputPath: string;
  protected logger: pino.Logger;

  constructor(university: string, handbookUrl: string, logger: pino.Logger) {
    this.university = university;
    this.handbookUrl = handbookUrl;
    this.unitOutputPath = "units.json";
    this.logger = logger.child({ university });
  }

  abstract getUnits(): Promise<ImportUnit[]>;
}
