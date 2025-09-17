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

import static org.hamcrest.CoreMatchers.is;
import static org.junit.Assert.assertThat;

import com.pholser.junit.quickcheck.Property;
import com.pholser.junit.quickcheck.runner.JUnitQuickcheck;
import com.sinch.testsupport.TestUtils;
import com.sinch.xms.ApiObjectMapper;
import com.sinch.xms.SinchSMSApi;
import com.sinch.xms.Utils;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.StringEscapeUtils;
import org.junit.runner.RunWith;

@RunWith(JUnitQuickcheck.class)
public class TagsUpdateTest {

  private final ApiObjectMapper json = new ApiObjectMapper();

  @Property
  public void canSerializeJson(List<String> toAdd, List<String> toRemove) throws Exception {
    TagsUpdate input =
        SinchSMSApi.tagsUpdate().addAllTagInsertions(toAdd).addAllTagRemovals(toRemove).build();

    List<String> escapedToAdd = new ArrayList<String>();
    for (String tag : toAdd) {
      escapedToAdd.add("\"" + StringEscapeUtils.escapeJson(tag) + "\"");
    }

    List<String> escapedToRemove = new ArrayList<String>();
    for (String tag : toRemove) {
      escapedToRemove.add("\"" + StringEscapeUtils.escapeJson(tag) + "\"");
    }

    String expected =
        Utils.join(
            "\n",
            "{",
            "  \"add\" : [" + Utils.join(",", escapedToAdd) + "],",
            "  \"remove\" : [" + Utils.join(",", escapedToRemove) + "]",
            "}");

    String actual = json.writeValueAsString(input);

    assertThat(actual, is(TestUtils.jsonEqualTo(expected)));
  }

  @Property
  public void canDeserializeJson(String[] toAdd, String[] toRemove) throws Exception {
    TagsUpdate expected =
        SinchSMSApi.tagsUpdate().addTagInsertion(toAdd).addTagRemoval(toRemove).build();

    String input = json.writeValueAsString(expected);

    TagsUpdate actual = json.readValue(input, TagsUpdate.class);

    assertThat(actual, is(expected));
  }
}
