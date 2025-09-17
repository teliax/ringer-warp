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

import * as Enums from '../enums/index';
import { RateModel } from "./RateModel";
import { JsonObject, JsonProperty } from "json2typescript";
import { DateConverter } from "../utils/dateConverter";

/**
 * Contains information about the general tangible personal property sales tax rates for this jurisdiction.
            
This rate is calculated by making assumptions about the tax calculation process.  It does not account for:
            
* Sourcing rules, such as origin-and-destination based transactions.
* Product taxability rules, such as different tax rates for different product types.
* Nexus declarations, where some customers are not obligated to collect tax in specific jurisdictions.
* Tax thresholds and rate differences by amounts.
* And many more custom use cases.
            
To upgrade to a fully-featured and accurate tax process that handles these scenarios correctly, please
contact Avalara to upgrade to AvaTax!
 * @export
 * @class TaxRateModel
 */
 @JsonObject("TaxRateModel")
 export class TaxRateModel {
    /**
     * @type {number}
     * @memberof TaxRateModel
     */
   @JsonProperty("totalRate", Number, true)
   totalRate?: number | undefined = undefined;
    /**
     * @type {RateModel[]}
     * @memberof TaxRateModel
     */
   @JsonProperty("rates", [RateModel], true)
   rates?: RateModel[] | undefined = undefined;
 }