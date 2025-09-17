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

import com.fasterxml.jackson.annotation.JsonTypeName;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import org.immutables.value.Value;

/** A mobile originated (MO) message with textual content. */
@Value.Immutable
@ValueStylePackage
@JsonDeserialize(builder = MoTextSms.Builder.class)
@JsonTypeName("mo_text")
public abstract class MoTextSms extends MoSms {

  /** A builder of text MO messages. */
  public static final class Builder extends MoTextSmsImpl.Builder {

    Builder() {}
  }

  /**
   * Creates a builder of {@link MoTextSms} instances.
   *
   * @return a builder
   */
  @Nonnull
  public static final MoTextSms.Builder builder() {
    return new Builder();
  }

  /**
   * The textual message body.
   *
   * @return the message body
   */
  public abstract String body();

  /**
   * The keyword provided with this MO message, if available.
   *
   * @return a keyword if available, otherwise <code>null</code>
   */
  @Nullable
  public abstract String keyword();
}
