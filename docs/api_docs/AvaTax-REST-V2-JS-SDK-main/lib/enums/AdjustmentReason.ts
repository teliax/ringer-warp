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
 export enum AdjustmentReason {
        NotAdjusted = 0,
        SourcingIssue = 1,
        ReconciledWithGeneralLedger = 2,
        ExemptCertApplied = 3,
        PriceAdjusted = 4,
        ProductReturned = 5,
        ProductExchanged = 6,
        BadDebt = 7,
        Other = 8,
        Offline = 9,
}

@JsonConverter
export class AdjustmentReasonConverter implements JsonCustomConvert<AdjustmentReason> {
    serialize(data: AdjustmentReason) {
        return data;
    }
    deserialize(enumType: string): AdjustmentReason {
        return AdjustmentReason[enumType as keyof typeof AdjustmentReason];
    }
}