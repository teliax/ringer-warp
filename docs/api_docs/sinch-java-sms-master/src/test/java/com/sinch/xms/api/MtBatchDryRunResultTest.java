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

import com.sinch.testsupport.TestUtils;
import com.sinch.xms.ApiObjectMapper;
import com.sinch.xms.Utils;
import org.junit.Test;

public class MtBatchDryRunResultTest {

  private final ApiObjectMapper json = new ApiObjectMapper();

  @Test
  public void canSerializeMinimal() throws Exception {
    MtBatchDryRunResult input =
        new MtBatchDryRunResult.Builder().numberOfRecipients(20).numberOfMessages(200).build();

    String expected =
        Utils.join("\n", "{", "  'number_of_recipients': 20,", "  'number_of_messages': 200", "}")
            .replace('\'', '"');

    String actual = json.writeValueAsString(input);

    assertThat(actual, is(TestUtils.jsonEqualTo(expected)));
  }

  @Test
  public void canDeserializeMinimal() throws Exception {
    MtBatchDryRunResult expected =
        new MtBatchDryRunResult.Builder().numberOfRecipients(20).numberOfMessages(200).build();

    String input = json.writeValueAsString(expected);

    MtBatchDryRunResult actual = json.readValue(input, MtBatchDryRunResult.class);

    assertThat(actual, is(expected));
  }

  @Test
  public void canSerializeWithPerRecipient() throws Exception {
    MtBatchDryRunResult input =
        new MtBatchDryRunResult.Builder()
            .numberOfRecipients(20)
            .numberOfMessages(200)
            .addPerRecipient(
                new MtBatchDryRunResult.PerRecipient.Builder()
                    .recipient("123456789")
                    .numberOfParts(3)
                    .body("body1")
                    .encoding("encoding1")
                    .build())
            .addPerRecipient(
                new MtBatchDryRunResult.PerRecipient.Builder()
                    .recipient("987654321")
                    .numberOfParts(2)
                    .body("body2")
                    .encoding("encoding2")
                    .build())
            .build();

    String expected =
        Utils.join(
                "\n",
                "{",
                "  'number_of_recipients': 20,",
                "  'number_of_messages': 200,",
                "  'per_recipient': [",
                "    {",
                "      'recipient': '123456789',",
                "      'number_of_parts': 3,",
                "      'body': 'body1',",
                "      'encoding': 'encoding1'",
                "    },",
                "    {",
                "      'recipient': '987654321',",
                "      'number_of_parts': 2,",
                "      'body': 'body2',",
                "      'encoding': 'encoding2'",
                "    }",
                "   ]",
                "}")
            .replace('\'', '"');

    String actual = json.writeValueAsString(input);

    assertThat(actual, is(TestUtils.jsonEqualTo(expected)));
  }

  @Test
  public void canDeserializeWithPerRecipient() throws Exception {
    MtBatchDryRunResult expected =
        new MtBatchDryRunResult.Builder()
            .numberOfRecipients(20)
            .numberOfMessages(200)
            .addPerRecipient(
                new MtBatchDryRunResult.PerRecipient.Builder()
                    .recipient("123456789")
                    .numberOfParts(3)
                    .body("body1")
                    .encoding("encoding1")
                    .build())
            .addPerRecipient(
                new MtBatchDryRunResult.PerRecipient.Builder()
                    .recipient("987654321")
                    .numberOfParts(2)
                    .body("body2")
                    .encoding("encoding2")
                    .build())
            .build();

    String input = json.writeValueAsString(expected);

    MtBatchDryRunResult actual = json.readValue(input, MtBatchDryRunResult.class);

    assertThat(actual, is(expected));
  }
}
