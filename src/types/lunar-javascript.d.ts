declare module 'lunar-javascript' {
	export class Lunar {
		getMonthInChinese(): string;
		getDayInChinese(): string;
		getYearInGanZhi(): string;
		getJieQi(): string;
		getFestivals(): string[];
	}

	export class Solar {
		static fromDate(date: Date): Solar;
		static fromYmd(year: number, month: number, day: number): Solar;
		getLunar(): Lunar;
		getFestivals(): string[];
	}
}
