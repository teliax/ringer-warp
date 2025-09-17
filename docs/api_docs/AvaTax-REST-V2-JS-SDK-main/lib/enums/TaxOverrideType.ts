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
 export enum TaxOverrideType {
        None = 0,
        TaxAmount = 1,
        Exemption = 2,
        TaxDate = 3,
        AccruedTaxAmount = 4,
        DeriveTaxable = 5,
        OutOfHarbor = 6,
        TaxAmountByTaxType = 7,
        VendorChargedTax = 8,
}

@JsonConverter
export class TaxOverrideTypeConverter implements JsonCustomConvert<TaxOverrideType> {
    serialize(data: TaxOverrideType) {
        return data;
    }
    deserialize(enumType: string): TaxOverrideType {
        return TaxOverrideType[enumType as keyof typeof TaxOverrideType];
    }
}