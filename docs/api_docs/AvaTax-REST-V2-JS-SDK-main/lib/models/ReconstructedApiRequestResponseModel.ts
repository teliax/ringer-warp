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
import { CreateTransactionModel } from "./CreateTransactionModel";
import { JsonObject, JsonProperty } from "json2typescript";
import { DateConverter } from "../utils/dateConverter";

/**
 * This model contains a reconstructed CreateTransaction request object that could potentially be used
to recreate this transaction.
            
Note that the API changes over time, and this reconstructed model is likely different from the exact request
that was originally used to create this transaction.
 * @export
 * @class ReconstructedApiRequestResponseModel
 */
 @JsonObject("ReconstructedApiRequestResponseModel")
 export class ReconstructedApiRequestResponseModel {
    /**
     * @type {CreateTransactionModel}
     * @memberof ReconstructedApiRequestResponseModel
     */
   @JsonProperty("request", CreateTransactionModel, true)
   request?: CreateTransactionModel | undefined = undefined;
 }