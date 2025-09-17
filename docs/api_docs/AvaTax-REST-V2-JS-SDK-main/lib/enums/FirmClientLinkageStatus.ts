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
 export enum FirmClientLinkageStatus {
        Requested = 1,
        Approved = 2,
        Rejected = 3,
        Revoked = 4,
}

@JsonConverter
export class FirmClientLinkageStatusConverter implements JsonCustomConvert<FirmClientLinkageStatus> {
    serialize(data: FirmClientLinkageStatus) {
        return data;
    }
    deserialize(enumType: string): FirmClientLinkageStatus {
        return FirmClientLinkageStatus[enumType as keyof typeof FirmClientLinkageStatus];
    }
}