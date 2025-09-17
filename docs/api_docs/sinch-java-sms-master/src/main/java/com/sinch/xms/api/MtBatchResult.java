/*-
 * #%L
 * SDK for Sinch SMS
 * %%
 * Copyright (C) 2016 Sinch
 * %%
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * #L%
 */
package com.sinch.xms.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonSubTypes.Type;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import javax.annotation.Nullable;

/** Base class for batch description classes. */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
  @Type(MtBatchTextSmsResult.class),
  @Type(MtBatchBinarySmsResult.class),
  @Type(MtBatchMmsResult.class)
})
public abstract class MtBatchResult {

  MtBatchResult() {
    // Intentionally left empty.
  }

  /**
   * The unique batch identifier. This identifier can be used to, for example fetch a delivery
   * reports and update or cancel the batch.
   *
   * @return a batch identifier
   */
  public abstract BatchId id();

  /**
   * The list of message recipients. May not be empty.
   *
   * @return a non-empty list of recipients
   */
  @JsonProperty("to")
  public abstract List<String> recipients();

  /**
   * The message originator. May be an MSISDN or short code.
   *
   * @return an originator address
   */
  @JsonProperty("from")
  @Nullable
  public abstract String sender();

  /**
   * The type of delivery report used for this batch.
   *
   * @return a type of report, <code>ReportType.NONE</code> if not provided
   */
  @JsonProperty("delivery_report")
  public abstract ReportType deliveryReport();

  /**
   * The URL to which batch callbacks are sent. If <code>null</code> then callbacks will be sent to
   * the default URL.
   *
   * @return an URL or <code>null</code> if the default callback URL is used
   */
  @Nullable
  public abstract URI callbackUrl();

  /**
   * The scheduled time this batch will be sent. If <code>null</code> or set to a past time then the
   * batch is sent immediately.
   *
   * @return the time when this batch will be sent
   */
  @Nullable
  @JsonProperty("send_at")
  public abstract OffsetDateTime sendAt();

  /**
   * The time when this batch will expire. Any message not delivered by this time will be placed
   * into an expired state and no further delivery will be attempted.
   *
   * @return the time when this batch expires
   */
  @Nullable
  @JsonProperty("expire_at")
  public abstract OffsetDateTime expireAt();

  /**
   * The time when this batch was created.
   *
   * @return the time when this batch was created
   */
  @Nullable
  @JsonProperty("created_at")
  public abstract OffsetDateTime createdAt();

  /**
   * The time when this batch was last modified.
   *
   * @return the time when this batch was last modified
   */
  @Nullable
  @JsonProperty("modified_at")
  public abstract OffsetDateTime modifiedAt();

  /**
   * Whether this batch has been canceled.
   *
   * @return <code>true</code> if the batch is canceled; <code>false</code> otherwise
   */
  public abstract boolean canceled();

  /**
   * The client identifier to attach to this message. If set, it will be added in the delivery
   * report/callback of this batch.
   *
   * @return a client reference id
   */
  @Nullable
  @JsonProperty("client_reference")
  public abstract String clientReference();

  /**
   * Send feedback if your system can confirm successful message delivery. Feedback can only be
   * provided if feedback_enabled was set when batch was submitted.
   *
   * @return boolean indicating if feedback is enabled
   */
  @Nullable
  @JsonProperty("feedback_enabled")
  public abstract Boolean feedbackEnabled();
}
