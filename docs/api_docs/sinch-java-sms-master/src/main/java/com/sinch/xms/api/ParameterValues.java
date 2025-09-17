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

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import java.util.Map;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import org.immutables.value.Value;

/** A description of possible substitution values for a template parameter. */
@Value.Immutable
@ValueStylePackage
@JsonDeserialize(using = JacksonUtils.ParameterValuesDeserializer.class)
@JsonSerialize(using = JacksonUtils.ParameterValuesSerializer.class)
public abstract class ParameterValues {

  /** A builder of parameter substitution values. */
  public static class Builder extends ParameterValuesImpl.Builder {

    Builder() {}
  }

  /**
   * Creates a builder of {@link ParameterValues} instances.
   *
   * @return a builder
   */
  @Nonnull
  public static final ParameterValues.Builder builder() {
    return new Builder();
  }

  /**
   * Describes per-recipient substitutions for a text message template.
   *
   * @return map from MSISDNs to textual substitutions
   */
  public abstract Map<String, String> substitutions();

  /**
   * The default substitution. Used when no matching substitution is found in {@link
   * #substitutions()}.
   *
   * @return the default value for the parameter; <code>null</code> if no default is set
   */
  @Nullable
  public abstract String defaultValue();
}
