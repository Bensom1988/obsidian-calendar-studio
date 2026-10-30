import { HolidayUtil, Solar } from 'lunar-javascript';
import { toDateKey } from './dateUtils';

/**
 * Optional Chinese calendar support: lunar date, solar terms, traditional
 * festivals, and statutory holidays / makeup workdays (休 / 班).
 *
 * Results are cached by local `YYYY-MM-DD` date key so rendering 42-cell month
 * grids never repeats the astronomical calculation for the same day.
 */

export interface LunarInfo {
	/** e.g. `八` */
	month: string;
	/** e.g. `初五` */
	day: string;
	/** Full lunar label, e.g. `八月初五` */
	label: string;
	/** Compact cell label (solar term > festival > holiday > month on 初一 > day). */
	shortLabel: string;
	/** Solar term such as `处暑`, or an empty string. */
	jieQi: string;
	/** Public or traditional festival, e.g. `中秋节`, or an empty string. */
	festival: string;
	/** Statutory holiday name when the date is part of a holiday schedule. */
	holiday: string;
	/**
	 * Statutory schedule flag:
	 * - `false`: statutory day off (休)
	 * - `true`: statutory makeup workday (班)
	 * - `undefined`: regular day
	 */
	isWorkday?: boolean;
}

const EMPTY: LunarInfo = {
	month: '',
	day: '',
	label: '',
	shortLabel: '',
	jieQi: '',
	festival: '',
	holiday: '',
};

const cache = new Map<string, LunarInfo>();
const MAX_CACHE_SIZE = 1024;

export function getLunarInfo(date: Date): LunarInfo {
	const key = toDateKey(date);
	const hit = cache.get(key);
	if (hit) return hit;

	try {
		const solar = Solar.fromDate(date);
		const lunar = solar.getLunar();
		const month = lunar.getMonthInChinese();
		const day = lunar.getDayInChinese();
		const jieQi = lunar.getJieQi() || '';
		const festival = lunar.getFestivals()[0] ?? solar.getFestivals()[0] ?? '';

		const statutory = HolidayUtil.getHoliday(
			date.getFullYear(),
			date.getMonth() + 1,
			date.getDate(),
		);
		const holiday = statutory?.getName() ?? '';
		const isWorkday = statutory ? statutory.isWork() : undefined;

		const dayOrMonth = day === '初一' ? `${month}月` : day;
		const shortLabel = jieQi || festival || (!isWorkday && holiday) || dayOrMonth;

		const info: LunarInfo = {
			month,
			day,
			label: `${month}月${day}`,
			shortLabel,
			jieQi,
			festival,
			holiday,
			isWorkday,
		};
		if (cache.size >= MAX_CACHE_SIZE) cache.clear();
		cache.set(key, info);
		return info;
	} catch (error) {
		console.error('[calendar-studio] lunar lookup failed:', error);
		return EMPTY;
	}
}
