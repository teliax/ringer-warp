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
import java.time.Clock;
import java.time.OffsetDateTime;
import org.junit.Test;

public class MoTextSmsTest {

  private final ApiObjectMapper json = new ApiObjectMapper();

  @Test
  public void canSerializeJson() throws Exception {
    String smsId = TestUtils.freshSmsId();
    OffsetDateTime receivedAt = OffsetDateTime.now(Clock.systemUTC());
    String receivedAtString = json.writeValueAsString(receivedAt);
    String body = "Здравей, свят!";

    MoSms input =
        new MoTextSms.Builder()
            .recipient("12345")
            .sender("987654321")
            .body(body)
            .id(smsId)
            .keyword("KWD")
            .receivedAt(receivedAt)
            .operator("operatorId")
            .build();

    String expected =
        Utils.join(
            "\n",
            "{",
            "  \"type\": \"mo_text\",",
            "  \"to\": \"12345\",",
            "  \"from\": \"987654321\",",
            "  \"id\": \"" + smsId + "\",",
            "  \"received_at\": " + receivedAtString + ",",
            "  \"body\": \"Здравей, свят!\",",
            "  \"keyword\": \"KWD\",",
            "  \"operator_id\": \"operatorId\"",
            "}");

    String actual = json.writeValueAsString(input);

    assertThat(actual, is(TestUtils.jsonEqualTo(expected)));
  }

  @Test
  public void canDeserializeJson() throws Exception {
    String smsId = TestUtils.freshSmsId();
    OffsetDateTime receivedAt = OffsetDateTime.now(Clock.systemUTC());

    MoSms expected =
        new MoTextSms.Builder()
            .recipient("12345")
            .sender("987654321")
            .body("Hello, world!")
            .id(smsId)
            .receivedAt(receivedAt)
            .operator("operatorId")
            .build();

    String input = json.writeValueAsString(expected);

    MoSms actual = json.readValue(input, MoSms.class);

    assertThat(actual, is(expected));
  }
}
