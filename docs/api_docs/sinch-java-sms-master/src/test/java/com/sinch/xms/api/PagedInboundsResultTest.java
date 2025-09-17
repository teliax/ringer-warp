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

public class PagedInboundsResultTest {

  private final ApiObjectMapper json = new ApiObjectMapper();

  @Test
  public void canSerializeJsonWithEmptyContent() throws Exception {
    PagedInboundsResult input =
        new PagedInboundsResult.Builder().page(0).size(0).totalSize(0).build();

    String expected =
        Utils.join(
                "\n",
                "{",
                "  'page' : 0,",
                "  'page_size' : 0,",
                "  'count' : 0,",
                "  'inbounds' : []",
                "}")
            .replace('\'', '"');

    String actual = json.writeValueAsString(input);

    assertThat(actual, is(TestUtils.jsonEqualTo(expected)));
  }

  @Test
  public void canDeserializeJsonWithEmptyContent() throws Exception {
    PagedInboundsResult expected =
        new PagedInboundsResult.Builder().page(0).size(0).totalSize(0).build();

    String input = json.writeValueAsString(expected);

    PagedInboundsResult actual = json.readValue(input, PagedInboundsResult.class);

    assertThat(actual, is(expected));
  }

  @Test
  public void canSerializeJsonWithNonEmptyBatches() throws Exception {
    String inboundsId1 = TestUtils.freshSmsId();
    String inboundsId2 = TestUtils.freshSmsId();
    OffsetDateTime time1 = OffsetDateTime.now(Clock.systemUTC());
    String timeString1 = json.writeValueAsString(time1);
    OffsetDateTime time2 = OffsetDateTime.now(Clock.systemUTC());
    String timeString2 = json.writeValueAsString(time2);

    MoSms inboundsResult1 =
        new MoTextSms.Builder()
            .sender("987654321")
            .recipient("54321")
            .id(inboundsId1)
            .receivedAt(time1)
            .sentAt(time2)
            .body("body1")
            .build();

    MoSms inboundsResult2 =
        new MoBinarySms.Builder()
            .sender("123456789")
            .recipient("12345")
            .id(inboundsId2)
            .receivedAt(time2)
            .sentAt(time1)
            .body("body2".getBytes(TestUtils.US_ASCII))
            .udh("udh".getBytes(TestUtils.US_ASCII))
            .build();

    PagedInboundsResult input =
        new PagedInboundsResult.Builder()
            .page(0)
            .size(1)
            .totalSize(0)
            .addContent(inboundsResult1)
            .addContent(inboundsResult2)
            .build();

    String expected =
        Utils.join(
                "\n",
                "{",
                "  'page' : 0,",
                "  'page_size' : 1,",
                "  'count' : 0,",
                "  'inbounds' : [",
                "    {",
                "      'type': 'mo_text',",
                "      'id': '" + inboundsId1 + "',",
                "      'from': '987654321',",
                "      'to': '54321',",
                "      'received_at': " + timeString1 + ",",
                "      'sent_at': " + timeString2 + ",",
                "      'body': 'body1'",
                "    },",
                "    {",
                "      'type': 'mo_binary',",
                "      'id': '" + inboundsId2 + "',",
                "      'from': '123456789',",
                "      'to': '12345',",
                "      'received_at': " + timeString2 + ",",
                "      'sent_at': " + timeString1 + ",",
                "      'body': 'Ym9keTI=',",
                "      'udh': '756468'",
                "    }",
                "  ]",
                "}")
            .replace('\'', '"');

    String actual = json.writeValueAsString(input);

    assertThat(actual, is(TestUtils.jsonEqualTo(expected)));
  }

  @Test
  public void canDeserializeJsonWithNonEmptyBatches() throws Exception {
    String inboundsId1 = TestUtils.freshSmsId();
    String inboundsId2 = TestUtils.freshSmsId();
    OffsetDateTime time1 = OffsetDateTime.now(Clock.systemUTC());
    OffsetDateTime time2 = OffsetDateTime.now(Clock.systemUTC());

    MoSms inboundsResult1 =
        new MoBinarySms.Builder()
            .sender("987654321")
            .recipient("54321")
            .id(inboundsId1)
            .receivedAt(time1)
            .sentAt(time2)
            .body("body1".getBytes(TestUtils.US_ASCII))
            .udh("test".getBytes(TestUtils.US_ASCII))
            .build();

    MoSms inboundsResult2 =
        new MoTextSms.Builder()
            .sender("123456789")
            .recipient("12345")
            .id(inboundsId2)
            .receivedAt(time2)
            .sentAt(time1)
            .body("body2")
            .build();

    PagedInboundsResult expected =
        new PagedInboundsResult.Builder()
            .page(0)
            .size(1)
            .totalSize(0)
            .addContent(inboundsResult1)
            .addContent(inboundsResult2)
            .build();

    String input = json.writeValueAsString(expected);

    PagedInboundsResult actual = json.readValue(input, PagedInboundsResult.class);

    assertThat(actual, is(expected));
  }
}
