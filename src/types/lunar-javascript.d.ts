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

	export class Holiday {
		getDay(): string;
		getName(): string;
		isWork(): boolean;
		getTarget(): string;
	}

	export class HolidayUtil {
		static getHoliday(year: number, month: number, day: number): Holiday | null;
	}
}
