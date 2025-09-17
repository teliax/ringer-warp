/*
 * AvaTax Software Development Kit for JavaScript
 *
 * (c) 2004-2022 Avalara, Inc.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * @author     Jonathan Wenger <jonathan.wenger@avalara.com>
 * @author     Sachin Baijal <sachin.baijal@avalara.com>
 * @copyright  2004-2018 Avalara, Inc.
 * @license    https://www.apache.org/licenses/LICENSE-2.0
 * @link       https://github.com/avadev/AvaTax-REST-V2-JS-SDK
 */

import { JsonConverter, JsonCustomConvert } from "json2typescript";

/**
* @export
* @enum {string}
*/
 export enum ScraperType {
        Login = 1,
        CustomerDorData = 2,
}

@JsonConverter
export class ScraperTypeConverter implements JsonCustomConvert<ScraperType> {
    serialize(data: ScraperType) {
        return data;
    }
    deserialize(enumType: string): ScraperType {
        return ScraperType[enumType as keyof typeof ScraperType];
    }
}