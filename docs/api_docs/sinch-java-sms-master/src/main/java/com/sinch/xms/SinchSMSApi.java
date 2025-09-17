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
package com.sinch.xms;

import com.sinch.xms.api.AutoUpdate;
import com.sinch.xms.api.FeedbackDeliveryCreate;
import com.sinch.xms.api.GroupCreate;
import com.sinch.xms.api.GroupUpdate;
import com.sinch.xms.api.MediaBody;
import com.sinch.xms.api.MtBatchBinarySmsCreate;
import com.sinch.xms.api.MtBatchBinarySmsUpdate;
import com.sinch.xms.api.MtBatchMmsCreate;
import com.sinch.xms.api.MtBatchMmsUpdate;
import com.sinch.xms.api.MtBatchTextSmsCreate;
import com.sinch.xms.api.MtBatchTextSmsUpdate;
import com.sinch.xms.api.ParameterValues;
import com.sinch.xms.api.TagsUpdate;
import javax.annotation.Nonnull;

/**
 * A collection of convenient static methods for building XMS objects. Each method here will return
 * a fresh builder producing the type of XMS object indicated by the method name.
 */
public final class SinchSMSApi { // TODO Maybe rename this to, e.g., "ApiBuilders"?

  /**
   * Returns a freshly created batch SMS builder for text messages.
   *
   * @return a builder of text batch messages
   */
  @Nonnull
  public static MtBatchTextSmsCreate.Builder batchTextSms() {
    return MtBatchTextSmsCreate.builder();
  }

  /**
   * Returns a freshly created builder for text message updates.
   *
   * @return a builder of text message updates
   */
  @Nonnull
  public static MtBatchTextSmsUpdate.Builder batchTextSmsUpdate() {
    return MtBatchTextSmsUpdate.builder();
  }

  /**
   * Returns a freshly created batch SMS builder for binary messages.
   *
   * @return a builder of binary batch messages
   */
  @Nonnull
  public static MtBatchBinarySmsCreate.Builder batchBinarySms() {
    return MtBatchBinarySmsCreate.builder();
  }

  /**
   * Returns a freshly created builder for binary message updates.
   *
   * @return a builder of binary message updates
   */
  @Nonnull
  public static MtBatchBinarySmsUpdate.Builder batchBinarySmsUpdate() {
    return MtBatchBinarySmsUpdate.builder();
  }

  /**
   * Returns a freshly created batch MMS message builder.
   *
   * @return a builder of MMS batch messages
   */
  @Nonnull
  public static MtBatchMmsCreate.Builder batchMms() {
    return MtBatchMmsCreate.builder();
  }

  /**
   * Returns a freshly created builder for MMS message updates.
   *
   * @return a builder of MMS message updates
   */
  @Nonnull
  public static MtBatchMmsUpdate.Builder batchMmsUpdate() {
    return MtBatchMmsUpdate.builder();
  }

  /**
   * Returns a freshly created builder for delivery feedback.
   *
   * @return a builder of delivery feedback
   */
  @Nonnull
  public static FeedbackDeliveryCreate.Builder deliveryFeedback() {
    return FeedbackDeliveryCreate.builder();
  }

  /**
   * Returns a freshly created builder of text message parameter substitutions.
   *
   * @return a builder of text parameter substitutions
   */
  @Nonnull
  public static ParameterValues.Builder parameterValues() {
    return ParameterValues.builder();
  }

  /**
   * Returns a freshly created builder of groups.
   *
   * @return a builder of groups
   */
  @Nonnull
  public static GroupCreate.Builder groupCreate() {
    return GroupCreate.builder();
  }

  /**
   * Returns a freshly created builder of auto update definitions. For use when creating groups.
   *
   * @return a builder of auto update definitions
   */
  @Nonnull
  public static AutoUpdate.Builder autoUpdate() {
    return AutoUpdate.builder();
  }

  /**
   * Returns a freshly created builder of group updates.
   *
   * @return a builder of group updates
   */
  @Nonnull
  public static GroupUpdate.Builder groupUpdate() {
    return GroupUpdate.builder();
  }

  /**
   * Returns a freshly created tags update builder.
   *
   * @return a builder of tags update requests
   */
  @Nonnull
  public static TagsUpdate.Builder tagsUpdate() {
    return TagsUpdate.builder();
  }

  /**
   * Returns a freshly created builder of batch filters.
   *
   * @return a builder of batch filters
   */
  @Nonnull
  public static BatchFilter.Builder batchFilter() {
    return BatchFilter.builder();
  }

  /**
   * Returns a freshly created builder of group filters.
   *
   * @return a builder of group filters
   */
  @Nonnull
  public static GroupFilter.Builder groupFilter() {
    return GroupFilter.builder();
  }

  /**
   * Returns a freshly created builder of inbound message filters.
   *
   * @return a builder of inbound message filters
   */
  @Nonnull
  public static InboundsFilter.Builder inboundsFilter() {
    return InboundsFilter.builder();
  }

  /**
   * Returns a freshly created batch delivery report parameter builder.
   *
   * @return a builder of batch delivery report queries
   */
  @Nonnull
  public static BatchDeliveryReportParams.Builder batchDeliveryReportParams() {
    return BatchDeliveryReportParams.builder();
  }

  /**
   * Returns a freshly created builder of delivery report filters.
   *
   * @return a builder of delivery report filters
   */
  @Nonnull
  public static DeliveryReportFilter.Builder deliveryReportFilter() {
    return DeliveryReportFilter.builder();
  }

  /**
   * Returns a freshly created builder of delivery report filters.
   *
   * @return a builder of delivery report filters
   */
  @Nonnull
  public static MediaBody.Builder mediaBody() {
    return MediaBody.builder();
  }
}
