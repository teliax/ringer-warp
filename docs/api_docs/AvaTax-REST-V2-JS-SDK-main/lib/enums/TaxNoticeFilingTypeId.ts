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
 export enum TaxNoticeFilingTypeId {
        ElectronicReturn = 1,
        PaperReturn = 2,
        ReturnNotFiled = 3,
        EFTPaper = 4,
        SER = 5,
        TrustfileEdi = 6,
        UploadFile = 7,
        PaperManual = 8,
        CertCapture = 9,
        SignatureReady = 10,
}

@JsonConverter
export class TaxNoticeFilingTypeIdConverter implements JsonCustomConvert<TaxNoticeFilingTypeId> {
    serialize(data: TaxNoticeFilingTypeId) {
        return data;
    }
    deserialize(enumType: string): TaxNoticeFilingTypeId {
        return TaxNoticeFilingTypeId[enumType as keyof typeof TaxNoticeFilingTypeId];
    }
}