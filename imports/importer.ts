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

  constructor(university: string) {
    this.university = university;
  }

  abstract getUnits(): Promise<ImportUnit[]>;
}
