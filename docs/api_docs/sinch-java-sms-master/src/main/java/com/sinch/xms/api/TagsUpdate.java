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
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.util.Set;
import javax.annotation.Nonnull;
import org.immutables.value.Value;

/** A description of updates to a set of tags. */
@Value.Immutable
@ValueStylePackage
@JsonDeserialize(builder = TagsUpdate.Builder.class)
public abstract class TagsUpdate {

  /** A builder of tag updates */
  public static final class Builder extends TagsUpdateImpl.Builder {

    Builder() {}
  }

  /**
   * Creates a builder of {@link TagsUpdate} instances.
   *
   * @return a builder
   */
  @Nonnull
  public static final TagsUpdate.Builder builder() {
    return new Builder();
  }

  /**
   * A set of tags to add to a given object.
   *
   * @return a non-null list of tags
   */
  @JsonProperty("add")
  public abstract Set<String> tagInsertions();

  /**
   * A set of tags to remove from a given object.
   *
   * @return a non-null list of tags
   */
  @JsonProperty("remove")
  public abstract Set<String> tagRemovals();
}
