import {formatAppDate, INPUT_DATE_FORMAT} from "./dateUtils.js";

export const getTodayInput = () => formatAppDate(new Date(), INPUT_DATE_FORMAT);
