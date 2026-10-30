import { Solar } from 'lunar-javascript';

/**
 * Optional Chinese calendar support: lunar date, solar terms and festivals.
 *
 * Wrapped in one module so the rest of the plugin never imports the library
 * directly and so the feature can be switched off entirely from settings.
 */

export interface LunarInfo {
	/** e.g. `八月` */
	month: string;
	/** e.g. `初五` */
	day: string;
	/** e.g. `八月十五` */
	label: string;
	/** Solar term such as `处暑`, or an empty string. */
	jieQi: string;
	/** Public or traditional festival, e.g. `中秋节`, or an empty string. */
	festival: string;
}

const EMPTY: LunarInfo = { month: '', day: '', label: '', jieQi: '', festival: '' };

export function getLunarInfo(date: Date): LunarInfo {
	try {
		const solar = Solar.fromDate(date);
		const lunar = solar.getLunar();
		const month = lunar.getMonthInChinese();
		const day = lunar.getDayInChinese();
		const jieQi = lunar.getJieQi() || '';
		const festival = solar.getFestivals()[0] ?? lunar.getFestivals()[0] ?? '';
		return { month, day, label: `${month}${day}`, jieQi, festival };
	} catch (error) {
		console.error('[calendar-studio] lunar lookup failed:', error);
		return EMPTY;
	}
}
