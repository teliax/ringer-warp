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
 export enum POABusinessUnit {
        Returns = 0,
        Lodging = 1,
        Telecom = 2,
}

@JsonConverter
export class POABusinessUnitConverter implements JsonCustomConvert<POABusinessUnit> {
    serialize(data: POABusinessUnit) {
        return data;
    }
    deserialize(enumType: string): POABusinessUnit {
        return POABusinessUnit[enumType as keyof typeof POABusinessUnit];
    }
}