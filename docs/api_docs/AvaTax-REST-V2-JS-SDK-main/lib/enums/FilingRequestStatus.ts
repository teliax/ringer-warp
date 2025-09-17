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
 export enum FilingRequestStatus {
        New = 1,
        Validated = 2,
        Pending = 3,
        Active = 4,
        PendingStop = 5,
        Inactive = 6,
        ChangeRequest = 7,
        RequestApproved = 8,
        RequestDenied = 9,
}

@JsonConverter
export class FilingRequestStatusConverter implements JsonCustomConvert<FilingRequestStatus> {
    serialize(data: FilingRequestStatus) {
        return data;
    }
    deserialize(enumType: string): FilingRequestStatus {
        return FilingRequestStatus[enumType as keyof typeof FilingRequestStatus];
    }
}