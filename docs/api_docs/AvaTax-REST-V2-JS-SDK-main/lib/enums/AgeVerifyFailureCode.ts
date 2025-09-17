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
 export enum AgeVerifyFailureCode {
        not_found = 0,
        dob_unverifiable = 1,
        under_age = 2,
        suspected_fraud = 3,
        deceased = 4,
        unknown_error = 5,
}

@JsonConverter
export class AgeVerifyFailureCodeConverter implements JsonCustomConvert<AgeVerifyFailureCode> {
    serialize(data: AgeVerifyFailureCode) {
        return data;
    }
    deserialize(enumType: string): AgeVerifyFailureCode {
        return AgeVerifyFailureCode[enumType as keyof typeof AgeVerifyFailureCode];
    }
}