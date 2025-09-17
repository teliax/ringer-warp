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
 export enum AddressCategoryId {
        Storefront = 1,
        MainOffice = 2,
        Warehouse = 3,
        Salesperson = 4,
        Other = 5,
        SellerRemitsTax = 6,
        MarketplaceRemitsTax = 7,
        NonPhysical = 8,
        Vendor = 9,
}

@JsonConverter
export class AddressCategoryIdConverter implements JsonCustomConvert<AddressCategoryId> {
    serialize(data: AddressCategoryId) {
        return data;
    }
    deserialize(enumType: string): AddressCategoryId {
        return AddressCategoryId[enumType as keyof typeof AddressCategoryId];
    }
}